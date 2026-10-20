"""
qa_pipeline.py
--------------
The NationPulse Bill Q&A pipeline: retrieve relevant Bill text chunks
for a user's natural-language question, optionally run a LegalRAG-style
relevance check and query refinement loop [b13], then generate a
grounded, source-attributed answer.

Corresponds to Section III-G (RAG-Based Question Answering) of the
NationPulse paper.
"""

import os
import re
import sys
from typing import Protocol

_src_dir = os.path.abspath(os.path.dirname(__file__))
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)

from vector_store import BillVectorStore

RELEVANCE_CHECK_PROMPT = """You are checking whether retrieved excerpts from a legislative Bill are relevant enough to answer a user's question.

Question: {question}

Retrieved excerpts:
{excerpts}

Do these excerpts contain enough information to answer the question? Reply with exactly one line:
RELEVANT
or
NOT_RELEVANT: <a rewritten version of the question that would retrieve better excerpts, preserving the original meaning>"""

ANSWER_SYSTEM_PROMPT = """You are an authoritative Legislative & Civic Intelligence Analyst for NationPulse, delivering executive-quality analysis on Indian Parliamentary legislation to enterprise organizations and citizens.

Your mandate is to provide polished, objective, accurate, and professional legal answers grounded in official Parliamentary Bills.

Communication & Style Rules:
1. Executive Tone: Write with clarity, precision, and institutional authority. Never use informal meta-jargon like "the provided excerpts", "based on the excerpts", "the text chunks", or "in excerpt [1]". Refer directly to the legislation (e.g., "Under The Kerala (Alteration of Name) Bill, 2026...", "Clause 4 specifies that...", "The statutory provisions indicate...").
2. Strict Factuality: Base your substantive answers strictly on the provided legislative material. Do not fabricate clauses, numbers, penalties, or statutory provisions.
3. Out-of-Scope / Unindexed Legislation:
   - If a citizen asks about a statute or topic not covered in the provided legislative materials (for example, the parent Central Goods and Services Tax Act, 2017, the Indian Penal Code, or an unindexed bill):
     Explain clearly and professionally that the matter is governed by that respective principal Act or unindexed legislation, and is not covered within the recent Parliamentary Bills currently indexed in this repository.
   - Do NOT say "the excerpts do not contain information". Instead say: "Provisions regarding [topic/statute] are not present in the Parliamentary Bills currently indexed in this repository. [Briefly clarify which primary Act or ministry regulates it if evident, e.g. 'Matters concerning scrutiny of returns and tax dues under GST are governed by the parent Central Goods and Services Tax (CGST) Act, 2017 rather than the recent amending Bills currently in this repository.']"
4. Statutory Distinctions:
   - Clearly distinguish between a Bill's own internal sections/clauses and Constitutional Articles. A Bill's clause "3" does not amend Article 3 of the Constitution unless explicitly stated.
   - Separate procedural references (e.g. Constitutional provisions under which a Bill was introduced) from actual amendments made by the Bill.
5. Specificity: If a specific date, deadline, duration, amount, penalty, or quorum is stated in the legislation, state it directly and prominently.
6. Multi-Bill Clarity: If materials from multiple Bills are provided, clearly attribute each fact or figure to its specific Bill title. Never conflate provisions across different Acts.
7. Do not include an artificial 'Sources:' line at the end; source attributions are handled programmatically."""

ANSWER_USER_PROMPT = """Question: {question}

Official Legislative Reference Material:
{excerpts}

Provide an executive, professional response to the question."""


def format_excerpts(chunks: list[dict]) -> str:
    lines = []
    for c in chunks:
        title = c["metadata"].get("bill_title", "Unknown Bill")
        lines.append(f"--- Bill: {title} ---\n{c['text']}")
    return "\n\n".join(lines)


def clean_unprofessional_meta_phrasing(text: str) -> str:
    """Guarantees that no internal robotic phrases slip into user-facing answers."""
    replacements = [
        (r"(?i)\bthe provided excerpts do not contain any information about\b", "The indexed Parliamentary Bills do not contain provisions regarding"),
        (r"(?i)\bthe provided excerpts do not contain information about\b", "The indexed Parliamentary Bills do not contain provisions regarding"),
        (r"(?i)\bthe provided excerpts do not contain a definition or explanation of\b", "The indexed Parliamentary Bills do not contain a definition or explanation of"),
        (r"(?i)\bthe provided excerpts do not contain\b", "The indexed Parliamentary Bills do not contain"),
        (r"(?i)\bthe provided excerpts do not\b", "The indexed Parliamentary Bills do not"),
        (r"(?i)\bbased on the provided excerpts,?\s*", ""),
        (r"(?i)\baccording to the provided excerpts,?\s*", "According to the legislation, "),
        (r"(?i)\bin the provided excerpts,?\s*", "In the legislative text, "),
        (r"(?i)\bthe provided excerpts\b", "the indexed legislative records"),
        (r"(?i)\bthe excerpts\b", "the legislative records"),
        (r"(?i)\bexcerpt\s*\[\d+\]\b", "the legislation"),
    ]
    for pattern, repl in replacements:
        text = re.sub(pattern, repl, text)
    return text.strip()


def strip_model_sources_line(text: str) -> str:
    """Removes any 'Sources:' section the model generated on its own."""
    return re.sub(r"\n*Sources:.*$", "", text, flags=re.IGNORECASE | re.DOTALL).strip()


def is_out_of_scope_answer(answer_text: str) -> bool:
    """Detects whether the answer indicates the topic/Act is unindexed or out-of-scope."""
    markers = [
        "not present in the parliamentary bills currently indexed",
        "not present in the legislative repository",
        "not covered within the recent parliamentary bills",
        "not present in the currently indexed",
        "is not present in the indexed",
        "not present in the available legislative",
        "outside the scope of the indexed bills",
        "couldn't find any relevant bill text",
    ]
    lower = answer_text.lower()
    return any(m in lower for m in markers)


def build_sources_line(chunks: list[dict], answer_text: str = "") -> str:
    """Builds the 'Sources:' line deterministically from the actual
    retrieved chunks' metadata. If the answer is an out-of-scope response,
    we do not append misleading unrelated sources."""
    if not chunks or (answer_text and is_out_of_scope_answer(answer_text)):
        return ""

    seen = []
    ans_lower = answer_text.lower() if answer_text else ""
    for c in chunks:
        title = c.get("metadata", {}).get("bill_title", "Unknown Bill")
        if title not in seen:
            clean_title = re.sub(r"[^a-z0-9]+", " ", title.lower()).strip()
            keywords = [
                w for w in clean_title.split()
                if len(w) > 3 and w not in {"bill", "amendment", "provisions", "laws", "national", "state"}
            ]
            if not ans_lower or any(kw in ans_lower for kw in keywords):
                seen.append(title)

    if not seen:
        seen = [chunks[0]["metadata"].get("bill_title", "Unknown Bill")]

    return "Sources: " + "; ".join(seen)


class ChatGenerator(Protocol):
    """Structural type for any generator backend."""
    def chat(self, system_prompt: str, user_prompt: str, max_new_tokens: int | None = None) -> str: ...


class BillQAPipeline:
    def __init__(self, config: dict, store: BillVectorStore, generator: ChatGenerator):
        self.config = config
        self.store = store
        self.generator = generator

    def answer(
        self,
        question: str,
        bill_id_filter: str | None = None,
        bill_title_filter: str | None = None,
    ) -> dict:
        r_cfg = self.config["retrieval"]
        rc_cfg = self.config["relevance_check"]

        if bill_id_filter is not None:
            # A stable source ID is a stronger, less brittle scope than the
            # displayed title, which may differ by punctuation or casing.
            bill_title_filter = None
        elif bill_title_filter is None:
            bill_title_filter = self.store.find_best_bill_title_match(question)

        current_query = question
        chunks: list[dict] = []
        iterations = 0
        max_iters = rc_cfg["max_refinement_iters"] if rc_cfg["enabled"] else 1
        is_relevant = False

        for iterations in range(1, max_iters + 1):
            chunks = self.store.similarity_search(
                current_query,
                top_k=r_cfg["top_k"],
                fetch_k=r_cfg["fetch_k"],
                use_mmr=r_cfg["use_mmr"],
                mmr_lambda=r_cfg["mmr_lambda"],
                bill_id_filter=bill_id_filter,
                bill_title_filter=bill_title_filter,
            )

            if not chunks:
                break
            if not rc_cfg["enabled"]:
                is_relevant = True
                break

            verdict = self._check_relevance(question, chunks)
            if verdict["relevant"]:
                is_relevant = True
                break
            current_query = verdict["refined_query"] or current_query

        answer_text = self._generate_answer(question, chunks, is_relevant=is_relevant)
        is_oos = is_out_of_scope_answer(answer_text)

        sources_payload = []
        if not is_oos and chunks:
            sources_payload = [
                {
                    "bill_id": c["metadata"].get("bill_id"),
                    "bill_title": c["metadata"].get("bill_title"),
                    "chunk_index": c["metadata"].get("chunk_index"),
                    "excerpt": c["text"][:200] + ("..." if len(c["text"]) > 200 else ""),
                }
                for c in chunks
            ]

        return {
            "question": question,
            "answer": answer_text,
            "refined_query": current_query if current_query != question else None,
            "refinement_iterations": iterations,
            "sources": sources_payload,
        }

    def _check_relevance(self, question: str, chunks: list[dict]) -> dict:
        excerpts = format_excerpts(chunks)
        try:
            response = self.generator.chat(
                "You are a strict relevance-checking assistant. Follow the output format exactly.",
                RELEVANCE_CHECK_PROMPT.format(question=question, excerpts=excerpts),
                max_new_tokens=60,
            )
        except Exception:
            return {"relevant": True, "refined_query": None}

        cleaned = re.sub(r"[*#_`\"']", "", response).strip()
        if cleaned.upper().startswith("RELEVANT") or "RELEVANT" in cleaned.upper().split():
            return {"relevant": True, "refined_query": None}

        match = re.search(r"NOT_RELEVANT:\s*(.+)", cleaned, re.IGNORECASE | re.DOTALL)
        refined = match.group(1).strip() if match else None
        return {"relevant": False, "refined_query": refined}

    def _generate_answer(self, question: str, chunks: list[dict], is_relevant: bool = True) -> str:
        if not chunks:
            return (
                "The available Parliamentary Bills currently indexed in this repository "
                "do not contain information regarding this topic."
            )

        if not is_relevant:
            # Chunks were retrieved but deemed irrelevant by the LegalRAG relevance filter.
            # Inform the model so it produces a graceful out-of-scope response rather than
            # fabricating facts from unrelated bills.
            reference_material = (
                "[Note: Retrieved legislative candidate texts from the current repository "
                "do not contain provisions governing this specific topic/statute.]"
            )
        else:
            reference_material = format_excerpts(chunks)

        raw_answer = self.generator.chat(
            ANSWER_SYSTEM_PROMPT,
            ANSWER_USER_PROMPT.format(question=question, excerpts=reference_material),
        )
        clean_answer = strip_model_sources_line(raw_answer)
        clean_answer = clean_unprofessional_meta_phrasing(clean_answer)

        sources_line = build_sources_line(chunks, clean_answer)
        if sources_line and not is_out_of_scope_answer(clean_answer):
            return f"{clean_answer}\n\n{sources_line}"
        return clean_answer
