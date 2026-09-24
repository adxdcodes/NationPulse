"""Postgres access for the ingestion service.

The one trick worth calling out: `upsert_bills` distinguishes truly-new
rows from rows that already existed and just got refreshed, using
`(xmax = 0) AS inserted` in the RETURNING clause. In Postgres, `xmax = 0`
on a freshly returned row means this exact statement inserted it — if the
ON CONFLICT branch updated an existing row instead, `xmax` is non-zero.
This is what lets us say "these 3 bills are genuinely new" instead of just
"we touched 400 rows," without a second query.
"""
import json
from contextlib import contextmanager

import psycopg2
import psycopg2.extras

import config
from normalize import normalize_bill, content_hash, extract_documents


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


def get_last_total(conn, house: str) -> int:
    with conn.cursor() as cur:
        cur.execute("SELECT last_total_bills FROM ingestion_state WHERE house = %s", (house,))
        row = cur.fetchone()
        return row[0] if row else 0


def update_state(conn, house: str, total: int, new_count: int, status: str, note: str = ""):
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO ingestion_state (house, last_total_bills, last_new_bills_count, last_run_at, last_run_status, last_run_note)
            VALUES (%s, %s, %s, now(), %s, %s)
            ON CONFLICT (house) DO UPDATE SET
                last_total_bills = EXCLUDED.last_total_bills,
                last_new_bills_count = EXCLUDED.last_new_bills_count,
                last_run_at = now(),
                last_run_status = EXCLUDED.last_run_status,
                last_run_note = EXCLUDED.last_run_note
        """, (house, total, new_count, status, note))


def upsert_bills(conn, raw_rows: list[dict]) -> list[dict]:
    """Upserts every bill in `raw_rows`. Returns a list of
    {id, bill_number, inserted} — `inserted=True` only for rows that did
    not exist before this call.
    """
    if not raw_rows:
        return []

    results = []
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        for raw in raw_rows:
            fields = normalize_bill(raw)
            fields["content_hash"] = content_hash(raw)
            cols = list(fields.keys())
            placeholders = ", ".join(f"%({c})s" for c in cols)
            col_list = ", ".join(cols)

            cur.execute(f"""
                INSERT INTO bills ({col_list}, last_seen_at, last_changed_at)
                VALUES ({placeholders}, now(), now())
                ON CONFLICT (bill_number, bill_year, introduced_house) DO UPDATE SET
                    status = EXCLUDED.status,
                    source_raw = EXCLUDED.source_raw,
                    passed_ls_date = EXCLUDED.passed_ls_date,
                    passed_rs_date = EXCLUDED.passed_rs_date,
                    act_no = EXCLUDED.act_no,
                    act_year = EXCLUDED.act_year,
                    assented_date = EXCLUDED.assented_date,
                    last_seen_at = now(),
                    last_changed_at = CASE
                        WHEN bills.content_hash IS DISTINCT FROM EXCLUDED.content_hash
                        THEN now() ELSE bills.last_changed_at END,
                    content_hash = EXCLUDED.content_hash
                RETURNING id, bill_number, (xmax = 0) AS inserted
            """, fields)
            row = cur.fetchone()
            results.append({**row, "raw": raw})
    return results


def upsert_documents(conn, bill_id: int, raw: dict):
    docs = extract_documents(raw)
    if not docs:
        return
    with conn.cursor() as cur:
        for doc_type, url, filename in docs:
            cur.execute("""
                INSERT INTO bill_documents (bill_id, doc_type, source_url, original_filename)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (bill_id, doc_type) DO UPDATE SET
                    source_url = EXCLUDED.source_url,
                    original_filename = EXCLUDED.original_filename,
                    extraction_status = CASE
                        WHEN bill_documents.source_url IS DISTINCT FROM EXCLUDED.source_url
                        THEN 'pending' ELSE bill_documents.extraction_status END
            """, (bill_id, doc_type, url, filename))
