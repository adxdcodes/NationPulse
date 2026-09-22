"""Postgres access layer for the extraction pipeline.

Uses `FOR UPDATE SKIP LOCKED` when claiming pending documents so that
multiple worker processes can run concurrently against the same table
without double-processing a row.
"""
import psycopg2
import psycopg2.extras
from contextlib import contextmanager

import config


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


def claim_pending_documents(conn, limit: int, doc_type: str | None = None, force: bool = False, bill_id: int | None = None):
    """Atomically claims up to `limit` documents for processing by flipping
    their status to 'downloading', and returns the joined bill+document rows
    needed to process them. Safe to call from multiple workers at once.
    """
    status_filter = "TRUE" if force else "bd.extraction_status IN ('pending', 'failed')"
    type_filter = "AND bd.doc_type = %(doc_type)s" if doc_type else ""
    bill_filter = "AND bd.bill_id = %(bill_id)s" if bill_id is not None else ""

    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(f"""
            WITH claimed AS (
                SELECT bd.id
                FROM bill_documents bd
                WHERE {status_filter} {type_filter} {bill_filter}
                ORDER BY bd.id
                LIMIT %(limit)s
                FOR UPDATE OF bd SKIP LOCKED
            )
            UPDATE bill_documents bd
            SET extraction_status = 'downloading'
            FROM claimed
            WHERE bd.id = claimed.id
            RETURNING bd.id, bd.bill_id, bd.doc_type, bd.source_url, bd.download_attempts
        """, {"limit": limit, "doc_type": doc_type, "bill_id": bill_id})
        claimed = cur.fetchall()

        if not claimed:
            return []

        ids = [row["id"] for row in claimed]
        cur.execute("""
            SELECT bd.id AS doc_id, bd.bill_id, bd.doc_type, bd.source_url,
                   bd.download_attempts, b.bill_number, b.bill_year, b.introduced_house
            FROM bill_documents bd
            JOIN bills b ON b.id = bd.bill_id
            WHERE bd.id = ANY(%s)
        """, (ids,))
        return cur.fetchall()


def mark_extracting(conn, doc_id: int):
    with conn.cursor() as cur:
        cur.execute("UPDATE bill_documents SET extraction_status = 'extracting' WHERE id = %s", (doc_id,))


def mark_success(conn, doc_id: int, *, storage_path: str, file_hash: str, file_size_bytes: int,
                  extracted_text: str, extraction_method: str, page_count: int, no_text_layer: bool = False):
    status = "no_text_layer" if no_text_layer else "done"
    with conn.cursor() as cur:
        cur.execute("""
            UPDATE bill_documents
            SET storage_path = %s, file_hash = %s, file_size_bytes = %s,
                downloaded_at = now(), extracted_text = %s, extraction_method = %s,
                extraction_status = %s, extracted_at = now(), page_count = %s,
                error_message = NULL
            WHERE id = %s
        """, (storage_path, file_hash, file_size_bytes, extracted_text,
              extraction_method, status, page_count, doc_id))


def mark_failed(conn, doc_id: int, error_message: str):
    with conn.cursor() as cur:
        cur.execute("""
            UPDATE bill_documents
            SET extraction_status = 'failed',
                download_attempts = download_attempts + 1,
                error_message = %s
            WHERE id = %s
        """, (error_message[:2000], doc_id))
