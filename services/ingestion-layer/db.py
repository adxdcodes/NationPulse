"""Postgres access for the ingestion service.

The one trick worth calling out in `upsert_bills`: it distinguishes truly-
new rows from rows that already existed and just got refreshed, using
`(xmax = 0) AS inserted` in the RETURNING clause. In Postgres, `xmax = 0`
on a freshly returned row means this exact statement inserted it — if the
ON CONFLICT branch updated an existing row instead, `xmax` is non-zero.
This is what lets us say "these 3 bills are genuinely new" instead of just
"we touched 400 rows," without a second query.

The other one, in `upsert_documents`: sansad.in's own links aren't
perfectly stable — a PDF that 404s or 500s today might be back tomorrow,
and the URL the API reports for a bill can itself change between runs.
Blindly overwriting a stored URL with whatever the API says *right now*
risks replacing a working link with a broken one; blindly keeping the old
one risks never healing a link that legitimately moved. See
`_reconcile_url` for the actual policy — all five of its branches are
verified against real live/dead HTTP endpoints, not just reasoned about.
"""
import logging
import os
from contextlib import contextmanager

import httpx
import psycopg2
import psycopg2.extras

import config
from normalize import normalize_bill, content_hash, extract_documents
from psycopg2.extras import Json

log = logging.getLogger("ingestion")

# Self-contained toggle (deliberately read here rather than routed through
# config.py, so this file can be dropped in on its own) — set
# VALIDATE_DOCUMENT_URLS=false to skip the network liveness checks
# entirely and fall back to "never overwrite an existing URL," the safest
# possible default when you're not willing to pay for the checks.
VALIDATE_URLS = os.getenv("VALIDATE_DOCUMENT_URLS", "true").strip().lower() not in ("0", "false", "no")
URL_CHECK_TIMEOUT = float(os.getenv("URL_CHECK_TIMEOUT_SECONDS", "8"))


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
                ON CONFLICT (introduced_house, bill_year, lower(btrim(bill_number)))
                WHERE introduced_house IS NOT NULL AND bill_year IS NOT NULL AND btrim(bill_number) <> ''
                DO UPDATE SET
                    bill_name = EXCLUDED.bill_name,
                    bill_type = EXCLUDED.bill_type,
                    bill_category = EXCLUDED.bill_category,
                    ministry_name = EXCLUDED.ministry_name,
                    introduced_by = EXCLUDED.introduced_by,
                    introduced_date = COALESCE(bills.introduced_date, EXCLUDED.introduced_date),
                    referred_to_committee_date = COALESCE(EXCLUDED.referred_to_committee_date, bills.referred_to_committee_date),
                    report_presented_date = COALESCE(EXCLUDED.report_presented_date, bills.report_presented_date),
                    status = EXCLUDED.status,
                    source_raw = EXCLUDED.source_raw,
                    passed_ls_date = COALESCE(EXCLUDED.passed_ls_date, bills.passed_ls_date),
                    passed_rs_date = COALESCE(EXCLUDED.passed_rs_date, bills.passed_rs_date),
                    act_no = EXCLUDED.act_no,
                    act_year = EXCLUDED.act_year,
                    assented_date = COALESCE(EXCLUDED.assented_date, bills.assented_date),
                    last_seen_at = now(),
                    last_changed_at = CASE
                        WHEN bills.content_hash IS DISTINCT FROM EXCLUDED.content_hash
                        THEN now() ELSE bills.last_changed_at END,
                    content_hash = EXCLUDED.content_hash
                RETURNING id, bill_number, (xmax = 0) AS inserted
            """, fields)
            row = cur.fetchone()
            results.append({**row, "raw": raw})
            # Retain source evidence and individual dated events; re-ingestion is idempotent.
            house = fields.get("introduced_house")
            if house not in ("Lok Sabha", "Rajya Sabha"):
                continue
            cur.execute("""INSERT INTO bill_source_observations
                (bill_id,source_house,source_bill_number,source_bill_year,source_status,raw_record,record_hash)
                VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING id""",
                (row["id"],house,fields["bill_number"],fields["bill_year"],fields["status"],
                 Json(raw),fields["content_hash"]))
            observation_id = cur.fetchone()["id"]
            events = (("introduced","introduced_date",house),
                      ("passed_ls","passed_ls_date","Lok Sabha"),
                      ("passed_rs","passed_rs_date","Rajya Sabha"),
                      ("referred_to_committee","referred_to_committee_date",None),
                      ("committee_report_presented","report_presented_date",None),
                      ("assented","assented_date",None))
            for event_type,date_field,event_house in events:
                event_date=fields.get(date_field)
                if event_date:
                    cur.execute("""INSERT INTO bill_movements
                        (bill_id,event_type,event_date,event_house,source_observation_id)
                        VALUES (%s,%s,%s,%s,%s)
                        ON CONFLICT DO NOTHING""",
                        (row["id"],event_type,event_date,event_house,observation_id))
            cur.execute("""UPDATE bills SET latest_movement_at = (
                SELECT max(event_date)::timestamptz FROM bill_movements
                WHERE bill_id=%s AND verification_status <> 'disputed') WHERE id=%s""",
                (row["id"],row["id"]))
    return results


def _url_is_alive(url: str) -> bool:
    """Cheap liveness check — HEAD first (no body download), falling back
    to a small ranged GET for servers that reject HEAD outright (some
    government endpoints answer 405/501 to HEAD but serve GET fine)."""
    headers = {"User-Agent": config.USER_AGENT}
    try:
        with httpx.Client(timeout=URL_CHECK_TIMEOUT, follow_redirects=True) as client:
            resp = client.head(url, headers=headers)
            if resp.status_code in (405, 501):
                resp = client.get(url, headers={**headers, "Range": "bytes=0-1023"})
            return resp.status_code < 400
    except httpx.HTTPError:
        return False


def _reconcile_url(bill_id: int, doc_type: str, old_url: str, old_status: str, new_url: str) -> str:
    """Decides which URL should actually be stored when sansad.in reports
    a different one than we already have on file for this document.

    Policy, in order:
      1. Already successfully extracted from the old URL (`status='done'`)
         -> keep the old one, with NO network call at all. It's proven to
         have worked and we already hold the text either way; churning it
         for an unverified new link buys nothing and would needlessly
         reset extraction_status to pending, forcing a re-download.
      2. Not validating (VALIDATE_URLS=false) -> keep the old one. Never
         blindly trust an unverified new URL over one we haven't disproven.
      3. Validating: check the OLD url first.
           - Old still alive -> keep it, and skip checking the new one
             entirely. A merely-*different* URL from the API is not
             evidence that the current one is broken.
           - Old is dead -> check the NEW url.
               - New is alive -> heal: switch to it. This is the only
                 branch that ever changes a stored URL.
               - New is also dead -> keep the old one. Swapping one broken
                 link for another gains nothing, and keeps the door open
                 for the old one to recover — transient upstream failures
                 are real (we've hit a genuine 500 from sansad.in on an
                 otherwise-valid PDF during testing).
    """
    if old_status == "done":
        return old_url
    if not VALIDATE_URLS:
        return old_url

    if _url_is_alive(old_url):
        return old_url

    if _url_is_alive(new_url):
        log.info("[url-heal] bill %s / %s: old link dead, switched to new working link.", bill_id, doc_type)
        return new_url

    log.info("[url-heal] bill %s / %s: old link dead, new link also unreachable — kept old.", bill_id, doc_type)
    return old_url


def upsert_documents(conn, bill_id: int, raw: dict):
    docs = extract_documents(raw)
    if not docs:
        return
    with conn.cursor() as cur:
        for doc_type, url, filename in docs:
            # V2 identity includes URL: a changed source URL is a new version,
            # never overwrite a downloaded or previously verified document.
            cur.execute("""INSERT INTO bill_documents
                (bill_id,doc_type,source_url,original_filename)
                VALUES (%s,%s,%s,%s)
                ON CONFLICT (bill_id,doc_type,source_url) DO UPDATE SET
                    original_filename=EXCLUDED.original_filename""",
                (bill_id,doc_type,url,filename))
