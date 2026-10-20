"""
supabase_client.py
------------------
Supabase client helper for NationPulse.
Handles connection setup, graceful degradation if credentials are not configured,
and provides helper methods for real-time Q&A persistence and Bill metadata.
"""

import os
import logging
from typing import Any, Dict, List, Optional
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

logger = logging.getLogger("nationpulse.supabase")

_supabase_client = None
_client_initialized = False


def get_supabase_client():
    """
    Returns the initialized Supabase client, or None if credentials are not provided.
    """
    global _supabase_client, _client_initialized
    if _client_initialized:
        return _supabase_client

    url = os.getenv("SUPABASE_URL", "").strip()
    # Accept service key (preferred for backend) or anon key
    key = os.getenv("SUPABASE_SERVICE_KEY", "").strip() or os.getenv("SUPABASE_KEY", "").strip()

    if not url or not key:
        logger.warning(
            "Supabase credentials not configured (SUPABASE_URL and SUPABASE_SERVICE_KEY/SUPABASE_KEY). "
            "Real-time database persistence is currently disabled."
        )
        _supabase_client = None
        _client_initialized = True
        return None

    try:
        from supabase import create_client, ClientOptions

        _supabase_client = create_client(
            url,
            key,
            options=ClientOptions(
                postgrest_client_timeout=10,
                storage_client_timeout=10,
            ),
        )
        logger.info(f"Supabase client connected to: {url}")
    except Exception as exc:
        logger.error(f"Failed to initialize Supabase client: {exc}")
        _supabase_client = None

    _client_initialized = True
    return _supabase_client


def is_supabase_enabled() -> bool:
    """Check if Supabase client is configured and available."""
    client = get_supabase_client()
    return client is not None


def check_supabase_health() -> Dict[str, Any]:
    """Verify Supabase connectivity with a lightweight ping query."""
    client = get_supabase_client()
    if client is None:
        return {"status": "disabled", "message": "Credentials not set in .env"}

    try:
        # Lightweight check on the QA bills table
        resp = client.table("qa_bills").select("bill_id", count="exact").limit(1).execute()
        return {
            "status": "connected",
            "table_count": resp.count,
        }
    except Exception as exc:
        return {
            "status": "error",
            "message": str(exc),
        }


def _house_for(bill_id: str) -> str:
    return "Rajya Sabha" if str(bill_id).upper().startswith("RS-") else "Lok Sabha"


def ensure_bills_exist(bills: Dict[str, Optional[str]]) -> None:
    """Make sure every bill_id has a row in `qa_bills` (FK target for
    qa_interactions / qa_bill_chunks). Existing rows are left untouched so
    metadata synced from sansad.in is never overwritten."""
    client = get_supabase_client()
    if not client or not bills:
        return
    rows = [
        {"bill_id": bid, "title": title or bid, "house": _house_for(bid)}
        for bid, title in bills.items()
        if bid
    ]
    try:
        client.table("qa_bills").upsert(rows, on_conflict="bill_id", ignore_duplicates=True).execute()
    except Exception as exc:
        logger.warning(f"Could not ensure bills exist: {exc}")


def mark_bills_indexed(bill_ids: List[str]) -> None:
    """Flag bills that have text chunks available for RAG."""
    client = get_supabase_client()
    if not client or not bill_ids:
        return
    try:
        for i in range(0, len(bill_ids), 100):
            client.table("qa_bills").update({"is_indexed": True}).in_(
                "bill_id", bill_ids[i : i + 100]
            ).execute()
    except Exception as exc:
        logger.warning(f"Could not mark bills as indexed: {exc}")


def save_qa_interaction(
    question: str,
    answer: str,
    sources: List[Dict[str, Any]],
    bill_id: Optional[str] = None,
    refined_query: Optional[str] = None,
    refinement_iterations: int = 1,
    metadata: Optional[Dict[str, Any]] = None,
) -> Optional[str]:
    """
    Persists a Q&A interaction to the 'qa_interactions' table.
    Supabase Realtime will automatically broadcast the INSERT to all subscribed React clients.
    Returns the created interaction UUID if successful, or None.

    If the caller didn't scope the question to a bill, bill_id is taken from
    the top retrieved source so the interaction is still linked to a bill.
    """
    client = get_supabase_client()
    if not client:
        return None

    sources = sources or []
    if not bill_id and sources:
        bill_id = sources[0].get("bill_id")
    if bill_id:
        title = next((s.get("bill_title") for s in sources if s.get("bill_id") == bill_id), None)
        ensure_bills_exist({bill_id: title})

    payload = {
        "question": question,
        "answer": answer,
        "sources": sources,
        "bill_id": bill_id,
        "refined_query": refined_query,
        "refinement_iterations": refinement_iterations,
        "metadata": metadata or {},
    }

    for attempt in range(2):
        try:
            resp = client.table("qa_interactions").insert(payload).execute()
            if resp.data:
                return resp.data[0].get("id")
            return None
        except Exception as exc:
            # 23503 = foreign key violation: keep the interaction, drop the link.
            if attempt == 0 and payload["bill_id"] and "23503" in str(exc):
                logger.warning(f"bill_id {payload['bill_id']} not in qa_bills; saving without link")
                payload["bill_id"] = None
                continue
            logger.warning(f"Could not persist QA interaction to Supabase: {exc}")
            return None
    return None


def update_qa_feedback(interaction_id: str, feedback_rating: int) -> bool:
    """
    Updates the feedback rating for an existing interaction (+1 or -1).
    """
    client = get_supabase_client()
    if not client:
        return False

    try:
        client.table("qa_interactions").update(
            {"feedback_rating": feedback_rating}
        ).eq("id", interaction_id).execute()
        return True
    except Exception as exc:
        logger.warning(f"Failed to update feedback for {interaction_id}: {exc}")
        return False


def get_recent_qa_history(limit: int = 20) -> List[Dict[str, Any]]:
    """Fetch the latest citizen Q&A history."""
    client = get_supabase_client()
    if not client:
        return []

    try:
        resp = (
            client.table("qa_interactions")
            .select("id, bill_id, question, answer, refined_query, sources, feedback_rating, created_at")
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return resp.data or []
    except Exception as exc:
        logger.warning(f"Failed to fetch QA history: {exc}")
        return []


def upsert_bills_batch(bills_data: List[Dict[str, Any]]) -> int:
    """Upsert a batch of bill records into the 'qa_bills' table."""
    client = get_supabase_client()
    if not client:
        return 0

    try:
        resp = client.table("qa_bills").upsert(bills_data, on_conflict="bill_id").execute()
        return len(resp.data or [])
    except Exception as exc:
        logger.error(f"Failed to upsert bills to Supabase: {exc}")
        return 0


def get_bills_list(limit: int = 50, indexed_only: bool = False) -> List[Dict[str, Any]]:
    """Fetch parliamentary bills from Supabase.

    indexed_only=True returns only bills whose text is in the RAG index
    (i.e. bills the Q&A endpoint can actually answer questions about).
    """
    client = get_supabase_client()
    if not client:
        return []

    cols = "bill_id, title, bill_number, bill_year, ministry, house, status, introduced_date, source_url"
    try:
        query = client.table("qa_bills").select(cols + ", is_indexed")
        if indexed_only:
            query = query.eq("is_indexed", True)
        resp = query.order("bill_id", desc=True).limit(limit).execute()
        return resp.data or []
    except Exception as exc:
        # is_indexed column missing => migration 002 not run yet
        if indexed_only:
            logger.warning(f"indexed_only filter unavailable (run 002_pgvector_rag.sql): {exc}")
            return []
        try:
            resp = client.table("qa_bills").select(cols).order("bill_id", desc=True).limit(limit).execute()
            return resp.data or []
        except Exception as exc2:
            logger.warning(f"Failed to fetch bills from Supabase: {exc2}")
            return []
