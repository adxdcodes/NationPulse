"""
vector_store.py
----------------
Wraps sentence-transformers and Supabase pgvector, providing index-time
(add_chunks) and query-time (dense + MMR retrieval) operations for
NationPulse Parliamentary Bill chunks.
"""

import os
import re
import sys
from typing import Any, Dict, List, Optional

_src_dir = os.path.abspath(os.path.dirname(__file__))
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)

import numpy as np
from sentence_transformers import SentenceTransformer

from chunking import Chunk
from supabase_client import (
    ensure_bills_exist,
    get_supabase_client,
    mark_bills_indexed,
)


def _vec_literal(vec) -> str:
    """pgvector text literal, e.g. '[0.1,0.2,...]' (accepted by PostgREST)."""
    return "[" + ",".join(f"{float(x):.7g}" for x in vec) + "]"


class VectorSearchTimeoutError(RuntimeError):
    """Raised when Supabase cancels a pgvector search at its statement limit."""


class BillVectorStore:
    """Supabase (pgvector) vector store for NationPulse.
    Chunks and embeddings live in the `qa_bill_chunks` table in Supabase.
    Retrieval runs through the `qa_match_bill_chunks` RPC function.
    """

    backend_name = "supabase"

    def __init__(self, config: dict, client=None):
        self.config = config
        self.client = client or get_supabase_client()
        if self.client is None:
            raise RuntimeError(
                "Supabase client could not be initialized. "
                "Please check SUPABASE_URL and SUPABASE_SERVICE_KEY in .env"
            )

        self.chunks_table = config.get("vector_store", {}).get(
            "chunks_table", "qa_bill_chunks"
        )
        self._indexed_bills_rpc: Optional[str] = None

        try:
            self._list_indexed_bills()
        except Exception as exc:
            if self._is_permission_denied(exc):
                raise RuntimeError(
                    "Supabase denied access to the QA vector tables. Run "
                    "nationpulse-qa/supabase_migrations/003_service_role_privileges.sql "
                    "in the Supabase SQL Editor, then restart the QA API."
                ) from exc
            raise RuntimeError(
                "Supabase QA vector schema is incomplete. Expected the "
                "qa_bill_chunks table and either qa_list_indexed_bills() or "
                "list_indexed_bills() RPC. Verify the deployed Supabase schema "
                "and run the applicable pgvector migration."
            ) from exc

        self.embed_model = SentenceTransformer(
            config["embedding"]["model_name"], device=config["embedding"]["device"]
        )
        self._titles_cache: List[str] = []
        self._refresh_titles_cache()

    def _refresh_titles_cache(self):
        try:
            rows = self._list_indexed_bills()
            titles = [
                title
                for row in rows
                if (title := (row.get("bill_title") or row.get("title")))
            ]
            self._titles_cache = list(dict.fromkeys(titles))
        except Exception:
            self._titles_cache = []

    @staticmethod
    def _is_missing_rpc(exc: Exception) -> bool:
        message = str(exc).lower()
        return "pgrst202" in message or "could not find the function" in message

    @staticmethod
    def _is_permission_denied(exc: Exception) -> bool:
        message = str(exc).lower()
        return "42501" in message or "permission denied" in message

    @staticmethod
    def _is_statement_timeout(exc: Exception) -> bool:
        message = str(exc).lower()
        return "57014" in message or "statement timeout" in message

    def _list_indexed_bills(self):
        """Support both the QA-prefixed RPC and the renamed deployed RPC."""
        names = [self._indexed_bills_rpc] if self._indexed_bills_rpc else []
        names.extend(name for name in ("qa_list_indexed_bills", "list_indexed_bills") if name not in names)
        last_error = None
        for name in names:
            try:
                result = self.client.rpc(name).execute()
                self._indexed_bills_rpc = name
                return result.data or []
            except Exception as exc:
                if not self._is_missing_rpc(exc):
                    raise
                last_error = exc
        if last_error:
            raise last_error
        return []

    def count(self) -> int:
        """Total indexed chunks in Supabase."""
        try:
            res = (
                self.client.table(self.chunks_table)
                .select("chunk_id", count="exact")
                .limit(1)
                .execute()
            )
            return res.count or 0
        except Exception:
            return 0

    def embed(self, texts: List[str]) -> np.ndarray:
        """Computes L2-normalized dense embeddings."""
        return self.embed_model.encode(
            texts, normalize_embeddings=True, show_progress_bar=False
        )

    def add_chunks(self, chunks: List[Chunk], batch_size: int = 200) -> int:
        """Upserts chunks and their vector embeddings into Supabase qa_bill_chunks."""
        if not chunks:
            return 0

        ensure_bills_exist({c.bill_id: c.bill_title for c in chunks})

        added = 0
        for i in range(0, len(chunks), batch_size):
            batch = chunks[i : i + batch_size]
            embeddings = self.embed([c.text for c in batch])
            rows = [
                {
                    "chunk_id": c.chunk_id,
                    "bill_id": c.bill_id,
                    "bill_title": c.bill_title,
                    "chunk_index": c.chunk_index,
                    "content": c.text,
                    "embedding": _vec_literal(emb),
                }
                for c, emb in zip(batch, embeddings)
            ]
            self.client.table(self.chunks_table).upsert(
                rows, on_conflict="chunk_id"
            ).execute()
            added += len(batch)

        mark_bills_indexed(sorted({c.bill_id for c in chunks}))
        self._refresh_titles_cache()
        return added

    def find_best_bill_title_match(self, query: str) -> Optional[str]:
        """Returns the most likely Bill title mentioned in a question, if any."""
        if not self._titles_cache:
            self._refresh_titles_cache()
        if not self._titles_cache:
            return None

        query_norm = self._normalize_text(query)
        if not query_norm:
            return None

        stopwords = {
            "the", "a", "an", "in", "on", "of", "for", "to", "and", "or", "is",
            "are", "what", "which", "why", "who", "how", "bill", "act",
            "amendment", "2026", "2025", "2024", "does", "do", "can", "under", "by", "state"
        }
        q_words = set(query_norm.split())
        q_sig = q_words - stopwords

        best_match = None
        best_score = 0.0

        for title in self._titles_cache:
            title_norm = self._normalize_text(title)
            if not title_norm:
                continue

            # Direct substring check
            if title_norm in query_norm or query_norm in title_norm:
                score = min(len(title_norm), len(query_norm)) / max(len(title_norm), len(query_norm))
                if score > best_score:
                    best_score = score
                    best_match = title
                continue

            # Core title without leading 'the' and trailing 'bill ...'
            core_title = re.sub(r"^(the\s+)", "", title_norm)
            core_title = re.sub(r"\s+bill.*$", "", core_title).strip()
            if core_title and (core_title in query_norm or query_norm in core_title):
                score = 0.9
                if score > best_score:
                    best_score = score
                    best_match = title
                continue

            # Distinctive keyword overlap
            t_words = set(title_norm.split())
            t_sig = t_words - stopwords
            if not t_sig:
                continue

            overlap = q_sig.intersection(t_sig)
            if len(overlap) >= 2:
                score = len(overlap) / len(t_sig)
                if score > best_score:
                    best_score = score
                    best_match = title
            elif len(overlap) == 1:
                distinctive = {"kerala", "tribunals", "minerals", "judges", "bankers", "honour", "anthem"}
                if overlap.intersection(distinctive):
                    score = 0.5
                    if score > best_score:
                        best_score = score
                        best_match = title

        return best_match if best_score >= 0.25 else None

    @staticmethod
    def _normalize_text(text: str) -> str:
        text = text.lower().strip()
        text = re.sub(r"[^a-z0-9]+", " ", text)
        return " ".join(text.split())

    def _rpc_search(
        self, query_embedding: np.ndarray, n: int, bill_id: Optional[str], bill_title: Optional[str]
    ) -> List[Dict[str, Any]]:
        params = {
            "query_embedding": _vec_literal(query_embedding),
            "match_count": n,
            "filter_bill_id": bill_id,
            "filter_bill_title": bill_title,
        }
        res = None
        last_error = None
        for rpc_name in ("qa_match_bill_chunks", "match_bill_chunks"):
            try:
                res = self.client.rpc(rpc_name, params).execute()
                break
            except Exception as exc:
                if not self._is_missing_rpc(exc):
                    if self._is_statement_timeout(exc):
                        raise VectorSearchTimeoutError(
                            "Supabase cancelled the QA vector search because it exceeded "
                            "the database statement timeout. From the repository root run "
                            "'.\\.venv\\Scripts\\python.exe Scripts\\build_qa_vector_index.py' "
                            "and connect with the Supabase session-mode database credentials, then retry."
                        ) from exc
                    raise
                last_error = exc
        if res is None:
            raise RuntimeError(
                "Supabase similarity-search RPC not found. Expected "
                "qa_match_bill_chunks() or match_bill_chunks()."
            ) from last_error
        return [
            {
                "chunk_id": r["chunk_id"],
                "text": r["content"],
                "metadata": {
                    "bill_id": r["bill_id"],
                    "bill_title": r["bill_title"],
                    "chunk_index": r["chunk_index"],
                },
                "distance": 1.0 - float(r["similarity"]),
            }
            for r in (res.data or [])
        ]

    def similarity_search(
        self,
        query: str,
        top_k: int = 5,
        fetch_k: int = 15,
        use_mmr: bool = True,
        mmr_lambda: float = 0.7,
        bill_id_filter: Optional[str] = None,
        bill_title_filter: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Retrieves top_k most relevant chunks using Supabase pgvector cosine search,
        optionally re-ranked using Maximal Marginal Relevance (MMR).
        """
        query_embedding = self.embed([query])[0]
        n_results = fetch_k if use_mmr else top_k

        candidates = self._rpc_search(
            query_embedding, n_results, bill_id_filter, bill_title_filter
        )
        if not candidates:
            return []
        if not use_mmr or len(candidates) <= top_k:
            return candidates[:top_k]
        return self._mmr_rerank(query_embedding, candidates, top_k, mmr_lambda)

    def _mmr_rerank(
        self, query_embedding: np.ndarray, candidates: List[Dict[str, Any]], top_k: int, lam: float
    ) -> List[Dict[str, Any]]:
        """Maximal Marginal Relevance: balances relevance against redundancy."""
        cand_texts = [c["text"] for c in candidates]
        cand_embeddings = self.embed(cand_texts)

        selected_idx: List[int] = []
        remaining_idx = list(range(len(candidates)))
        query_sims = cand_embeddings @ query_embedding

        while remaining_idx and len(selected_idx) < top_k:
            if not selected_idx:
                best = max(remaining_idx, key=lambda i: query_sims[i])
            else:
                selected_embs = cand_embeddings[selected_idx]

                def mmr_score(i):
                    relevance = query_sims[i]
                    redundancy = max(
                        float(cand_embeddings[i] @ selected_embs[j])
                        for j in range(len(selected_idx))
                    )
                    return lam * relevance - (1 - lam) * redundancy

                best = max(remaining_idx, key=mmr_score)

            selected_idx.append(best)
            remaining_idx.remove(best)

        return [candidates[i] for i in selected_idx]


# Backward compatibility aliases
SupabaseVectorStore = BillVectorStore


def build_vector_store(config: dict) -> BillVectorStore:
    """Builds and returns the Supabase pgvector store."""
    return BillVectorStore(config)
