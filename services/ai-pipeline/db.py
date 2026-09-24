"""Postgres access for the AI summarization pipeline.

Concurrency model: claiming a bill = successfully inserting a 'generating'
row into bill_ai_content. The partial unique index in schema.sql
(one active row per bill_id) makes that insert fail with a conflict if
another worker already claimed it — so `reserve_generation` doubles as
both the lock and the placeholder row that gets filled in afterward.
"""
import psycopg2
import psycopg2.extras
from contextlib import contextmanager

import config

# Priority order for which extracted document counts as the "final" text
# for a bill — the most authoritative version available.
PRIMARY_DOC_PRIORITY = ["passed_both_houses", "gazetted", "passed_rs", "passed_ls", "introduced"]


@contextmanager
def get_conn():
    conn = psycopg2.connect(config.DATABASE_URL)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def find_candidate_bills(conn, limit: int, bill_id: int | None = None):
    """Bills that have at least one successfully extracted document and no
    active (generating/pending_review) AI content yet.

    Pass `bill_id` to scope this to exactly one bill — the admin-triggered
    "process this bill" path uses this. Note this does NOT bypass the
    "no active row" check: if that bill already has a generating/
    pending_review row, it's correctly skipped rather than double-run.
    """
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("""
            SELECT b.id AS bill_id
            FROM bills b
            WHERE EXISTS (
                SELECT 1 FROM bill_documents bd
                WHERE bd.bill_id = b.id AND bd.extraction_status = 'done'
            )
            AND NOT EXISTS (
                SELECT 1 FROM bill_ai_content ac
                WHERE ac.bill_id = b.id AND ac.review_status IN ('generating', 'pending_review')
            )
            AND (%(bill_id)s::bigint IS NULL OR b.id = %(bill_id)s)
            ORDER BY b.id
            LIMIT %(limit)s
        """, {"limit": limit, "bill_id": bill_id})
        return [row["bill_id"] for row in cur.fetchall()]


def get_bill_with_texts(conn, bill_id: int, document_id: int | None = None):
    """Returns bill metadata plus the primary (most authoritative) extracted
    text and, separately, the 'introduced' text if it differs — used to
    build the before/after comparison in the prompt."""
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("""
            SELECT id AS bill_id, bill_number, bill_name, ministry_name, bill_year,
                   introduced_house, status
            FROM bills WHERE id = %s
        """, (bill_id,))
        bill = cur.fetchone()
        if not bill:
            return None

        cur.execute("""
            SELECT id, doc_type, extracted_text
            FROM bill_documents
            WHERE bill_id = %s AND extraction_status = 'done' AND length(trim(coalesce(extracted_text, ''))) > 0
        """, (bill_id,))
        document_rows = cur.fetchall()
        if not document_rows:
            return None
        docs = {row["doc_type"]: row for row in document_rows}
        if document_id is not None:
            primary = next((d for d in document_rows if d["id"] == document_id), None)
            if primary is None:
                return None
            primary_type = primary["doc_type"]
        else:
            primary_type = next((t for t in PRIMARY_DOC_PRIORITY if t in docs), None) or next(iter(docs))
            primary = docs[primary_type]
        introduced = docs.get("introduced")

        bill["primary_doc_id"] = primary["id"]
        bill["primary_doc_type"] = primary_type
        bill["primary_text"] = primary["extracted_text"]
        bill["introduced_text"] = introduced["extracted_text"] if introduced else None
        return bill


def reserve_generation(conn, bill_id: int, provider: str, model: str) -> int | None:
    """Attempts to claim `bill_id` for generation. Returns the new row's id,
    or None if another worker already claimed it (conflict on the partial
    unique index) — the caller should just skip it, not treat it as an error."""
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO bill_ai_content (bill_id, provider, model_version, prompt_version, review_status)
            VALUES (%s, %s, %s, %s, 'generating')
            ON CONFLICT DO NOTHING
            RETURNING id
        """, (bill_id, provider, model, config.PROMPT_VERSION))
        row = cur.fetchone()
        return row[0] if row else None


def save_success(conn, row_id: int, *, source_doc_id: int, parsed: dict, raw_response: dict,
                 input_char_count: int, latency_ms: int, model_version: str):
    with conn.cursor() as cur:
        cur.execute("""
            UPDATE bill_ai_content SET
                model_version = %s,
                source_doc_id = %s,
                plain_title = %s,
                summary = %s,
                why_it_matters = %s,
                topic = %s,
                key_changes = %s,
                confidence_notes = %s,
                input_char_count = %s,
                latency_ms = %s,
                raw_response = %s,
                review_status = 'pending_review',
                error_message = NULL,
                generated_at = now()
            WHERE id = %s
        """, (
            model_version, source_doc_id, parsed.get("plain_title"), parsed.get("summary"),
            parsed.get("why_it_matters"), parsed.get("topic"),
            psycopg2.extras.Json(parsed.get("key_changes") or []),
            parsed.get("confidence_notes"), input_char_count, latency_ms,
            psycopg2.extras.Json(raw_response), row_id,
        ))


def save_failure(conn, row_id: int, error_message: str):
    with conn.cursor() as cur:
        cur.execute("""
            UPDATE bill_ai_content
            SET review_status = 'failed', error_message = %s
            WHERE id = %s
        """, (error_message[:2000], row_id))

# Note: this file used to also have mark_job_running/mark_job_done/
# mark_job_failed here, writing directly to processing_jobs. Removed —
# that's now the API's job (routers/processing.py watches this process's
# exit code from the parent side instead of trusting it to self-report,
# which is strictly more robust: it catches a crash at any point, not
# just ones this script's own error handling happens to reach).
