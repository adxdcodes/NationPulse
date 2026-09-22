"""Public bill endpoints. Every query here joins against the LATEST
APPROVED bill_ai_content row and nothing else — a bill with no approved
summary yet simply does not exist as far as this router is concerned. That
one INNER JOIN is what keeps unreviewed/AI-drafted content out of the
public site; the admin router is the only place `pending_review` rows are
visible.
"""
from fastapi import APIRouter, Depends, HTTPException, Query

import config
from db import get_conn
from serialize import serialize_bill

router = APIRouter(tags=["bills"])

# One CTE reused by every endpoint below: bills joined to their most recent
# APPROVED ai-content row. DISTINCT ON picks the latest by generated_at
# per bill, so re-generated/re-approved content never produces duplicates.
LATEST_APPROVED_CTE = """
    WITH approved_content AS (
        SELECT DISTINCT ON (bill_id) *
        FROM bill_ai_content
        WHERE review_status = 'approved'
        ORDER BY bill_id, generated_at DESC
    )
"""


@router.get("/bills")
def list_bills(
    domain: str = Query(default=None),
    topic: str = Query(default=None),
    status: str = Query(default=None),
    q: str = Query(default=None, description="Free-text search across title, summary, why-it-matters"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=None, ge=1),
    conn=Depends(get_conn),
):
    page_size = min(page_size or config.DEFAULT_PAGE_SIZE, config.MAX_PAGE_SIZE)
    offset = (page - 1) * page_size

    where = ["true"]
    params = {}

    # `domain` is accepted for forward-compatibility with the frontend's
    # existing filter UI, but every bill today is "Parliament" — see
    # serialize.py. Any other value currently returns zero rows.
    if domain and domain != "All":
        where.append("%(domain)s = 'Parliament'")
        params["domain"] = domain
    if topic and topic != "All":
        where.append("ac.topic = %(topic)s")
        params["topic"] = topic
    if status and status != "All":
        # normalized in Python, not SQL, so this compares against the raw
        # values STATUS_MAP maps FROM — simplest correct thing given the
        # mapping table is small; move to a SQL CASE if it grows.
        from status_map import STATUS_MAP
        raw_values = [raw for raw, norm in STATUS_MAP.items() if norm == status]
        if raw_values:
            where.append("b.status = ANY(%(raw_statuses)s)")
            params["raw_statuses"] = raw_values
        else:
            where.append("false")
    if q:
        where.append("(b.bill_name ILIKE %(q)s OR ac.summary ILIKE %(q)s OR ac.why_it_matters ILIKE %(q)s)")
        params["q"] = f"%{q}%"

    params["limit"] = page_size
    params["offset"] = offset

    with conn.cursor() as cur:
        cur.execute(f"""
            {LATEST_APPROVED_CTE}
            SELECT b.*, ac.plain_title, ac.summary, ac.why_it_matters, ac.topic,
                   ac.key_changes, ac.confidence_notes,
                   (SELECT count(*) FROM comments c WHERE c.bill_id = b.id) AS comment_count
            FROM bills b
            JOIN approved_content ac ON ac.bill_id = b.id
            WHERE {' AND '.join(where)}
            ORDER BY b.introduced_date DESC NULLS LAST
            LIMIT %(limit)s OFFSET %(offset)s
        """, params)
        rows = cur.fetchall()

        cur.execute(f"""
            {LATEST_APPROVED_CTE}
            SELECT count(*) AS total
            FROM bills b JOIN approved_content ac ON ac.bill_id = b.id
            WHERE {' AND '.join(where)}
        """, params)
        total = cur.fetchone()["total"]

    return {
        "items": [serialize_bill({**r, "bill_id": r["id"]}, comment_count=r["comment_count"]) for r in rows],
        "page": page, "page_size": page_size, "total": total,
    }


@router.get("/bills/{bill_id}")
def get_bill(bill_id: int, conn=Depends(get_conn)):
    with conn.cursor() as cur:
        cur.execute(f"""
            {LATEST_APPROVED_CTE}
            SELECT b.*, ac.plain_title, ac.summary, ac.why_it_matters, ac.topic,
                   ac.key_changes, ac.confidence_notes,
                   (SELECT count(*) FROM comments c WHERE c.bill_id = b.id) AS comment_count
            FROM bills b JOIN approved_content ac ON ac.bill_id = b.id
            WHERE b.id = %(id)s
        """, {"id": bill_id})
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Bill not found (or has no approved summary yet).")

        cur.execute("""
            SELECT doc_type, source_url, storage_path, page_count
            FROM bill_documents WHERE bill_id = %s ORDER BY doc_type
        """, (bill_id,))
        documents = cur.fetchall()

        cur.execute("""
            SELECT m.id, m.name, m.party, m.constituency
            FROM bill_sponsors bs JOIN mps m ON m.id = bs.mp_id
            WHERE bs.bill_id = %s
        """, (bill_id,))
        sponsors = cur.fetchall()

    result = serialize_bill({**row, "bill_id": row["id"]}, comment_count=row["comment_count"])
    result["documents"] = documents
    result["sponsors"] = sponsors
    return result


@router.get("/topics")
def list_topics(conn=Depends(get_conn)):
    with conn.cursor() as cur:
        cur.execute(f"""
            {LATEST_APPROVED_CTE}
            SELECT ac.topic, count(*) AS count
            FROM bills b JOIN approved_content ac ON ac.bill_id = b.id
            WHERE ac.topic IS NOT NULL
            GROUP BY ac.topic ORDER BY count DESC
        """)
        rows = cur.fetchall()
    return {"items": [{"name": r["topic"], "count": r["count"], "topDomain": "Parliament"} for r in rows]}
