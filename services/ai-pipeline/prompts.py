"""The output schema every provider is forced to conform to, and the
prompt that instructs the model how to fill it in.

Keeping the schema and the prompt in one file means they can never drift
apart silently — if you add a field to the schema, this is the one place
you also have to explain to the model what belongs in it.
"""
from pathlib import Path

# Matches the topic taxonomy already used on the frontend (src/data/mockData.js
# TOPICS list) — the model is constrained to pick one of these, or "Other",
# so results plug directly into the existing topic filter/pages.
TOPIC_TAXONOMY = [
    "Digital Rights", "Energy", "Elections", "Education",
    "Finance & Banking", "Transport", "Property & Law", "Other",
]

BILL_SUMMARY_SCHEMA = {
    "type": "object",
    "properties": {
        "plain_title": {
            "type": "string",
            "description": "The bill's official title, lightly simplified if it's dense legal phrasing. Do not invent a different title.",
        },
        "summary": {
            "type": "string",
            "description": "2-4 sentences, plain language, describing what the bill actually does. No legalese, no editorializing.",
        },
        "why_it_matters": {
            "type": "string",
            "description": "1-3 sentences, concrete and specific, explaining how this could affect an ordinary citizen. Avoid vague statements like 'this could impact many people.'",
        },
        "topic": {
            "type": "string",
            "enum": TOPIC_TAXONOMY,
            "description": "The single best-fitting topic from the allowed list.",
        },
        "key_changes": {
            "type": "array",
            "description": "Only populate this if BOTH an original and a revised/final version of the bill text were provided below. Each entry is one specific provision that changed. Leave as an empty array if only one version of the text was given.",
            "items": {
                "type": "object",
                "properties": {
                    "before": {"type": "string", "description": "The provision as it was in the earlier version. Under 25 words."},
                    "after": {"type": "string", "description": "The provision as it is in the later version. Under 25 words."},
                },
                "required": ["before", "after"],
            },
        },
        "confidence_notes": {
            "type": "string",
            "description": "Optional. Note anything you were unsure about, any section that seemed truncated, or any claim you could not verify from the provided text. Empty string if none.",
        },
    },
    "required": ["plain_title", "summary", "why_it_matters", "topic", "key_changes", "confidence_notes"],
}

SYSTEM_PROMPT = """You are a non-partisan legislative analyst working for a civic transparency \
platform that helps ordinary citizens understand what their government is doing. Your summaries \
are read by people with no legal background.

Rules you must follow:
1. Base every claim ONLY on the bill text provided below. Never use outside knowledge about the \
bill, never guess at intent, and never fill gaps with assumptions.
2. Write in plain, neutral, sentence-case language. No legal jargon, no bureaucratic phrasing, no \
editorializing, no political framing of any kind — describe what the bill does, not whether it is \
good or bad policy.
3. Be specific. "This bill affects many sectors" is not acceptable; name the sector, the number, \
the deadline, the affected group — whatever is actually in the text.
4. If the provided text appears cut off, incomplete, or you are not confident about a detail, say \
so in confidence_notes rather than guessing.
5. Output must match the given JSON schema exactly. No text outside the JSON structure.
"""

DEFAULT_PROMPT_FILE = Path(__file__).with_name("summary_prompt.txt")


def load_prompt(prompt: str | None = None) -> str:
    """Use a supplied prompt, or load the repository's default prompt file."""
    if prompt and prompt.strip():
        return prompt.strip()
    return DEFAULT_PROMPT_FILE.read_text(encoding="utf-8").strip()


def build_user_prompt(*, bill_number: str, bill_name: str, ministry: str | None, bill_year,
                       house: str | None, status: str, primary_text: str,
                       introduced_text: str | None = None, max_chars: int = 45000,
                       prompt: str | None = None) -> str:
    def clip(text: str, limit: int) -> tuple[str, bool]:
        text = text.strip()
        if len(text) <= limit:
            return text, False
        return text[:limit], True

    parts = [
        load_prompt(prompt),
        "",
        f"BILL METADATA",
        f"Number: {bill_number}",
        f"Title: {bill_name}",
        f"Ministry: {ministry or 'Not specified'}",
        f"Year: {bill_year}",
        f"House introduced: {house or 'Not specified'}",
        f"Current status: {status}",
        "",
    ]

    has_two_versions = bool(introduced_text and introduced_text.strip() and introduced_text.strip() != primary_text.strip())

    if has_two_versions:
        intro_clipped, intro_truncated = clip(introduced_text, max_chars // 2)
        primary_clipped, primary_truncated = clip(primary_text, max_chars // 2)
        parts += [
            "ORIGINAL TEXT AS INTRODUCED:",
            intro_clipped,
            "[...truncated...]" if intro_truncated else "",
            "",
            "FINAL / CURRENT TEXT:",
            primary_clipped,
            "[...truncated...]" if primary_truncated else "",
            "",
            "Two versions of the bill text are provided above. Compare them and populate "
            "key_changes with the specific provisions that changed between the introduced "
            "version and the final version.",
        ]
    else:
        primary_clipped, primary_truncated = clip(primary_text, max_chars)
        parts += [
            "BILL TEXT:",
            primary_clipped,
            "[...truncated...]" if primary_truncated else "",
            "",
            "Only one version of the bill text is available. Leave key_changes as an empty array.",
        ]

    return "\n".join(p for p in parts if p is not None)
