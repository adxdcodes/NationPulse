"""Admin endpoints. All require `require_admin` — a real per-user role now,
not the old frontend's shared password (see README "Suggested changes").
"""
from fastapi import APIRouter, Depends, HTTPException, Query

from db import get_conn
from auth import require_admin
from models import AdminContentEdit
from urls import as_text_url

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/queue")
def review_queue(admin: dict = Depends(require_admin), conn=Depends(get_conn)):
    with conn.cursor() as cur:
        cur.execute("""
            SELECT ac.id AS content_id, ac.bill_id, ac.provider, ac.model_version, ac.generated_at,
                   ac.plain_title, ac.summary, ac.why_it_matters, ac.topic, ac.key_changes,
                   ac.confidence_notes, b.bill_number, b.bill_name, b.status, b.introduced_date
            FROM bill_ai_content ac JOIN bills b ON b.id = ac.bill_id
            WHERE ac.review_status = 'pending_review'
            ORDER BY ac.generated_at ASC
        """)
        rows = cur.fetchall()
    return {"items": rows}


@router.post("/queue/{content_id}/approve")
def approve(content_id: int, admin: dict = Depends(require_admin), conn=Depends(get_conn)):
    with conn.cursor() as cur:
        cur.execute("""
            UPDATE bill_ai_content SET review_status = 'approved', reviewed_by = %s, reviewed_at = now()
            WHERE id = %s AND review_status = 'pending_review'
            RETURNING id
        """, (admin["email"], content_id))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Not found, or already reviewed.")
    return {"id": content_id, "reviewStatus": "approved"}


@router.post("/queue/{content_id}/reject")
def reject(content_id: int, admin: dict = Depends(require_admin), conn=Depends(get_conn)):
    with conn.cursor() as cur:
        cur.execute("""
            UPDATE bill_ai_content SET review_status = 'rejected', reviewed_by = %s, reviewed_at = now()
            WHERE id = %s AND review_status = 'pending_review'
            RETURNING id
        """, (admin["email"], content_id))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Not found, or already reviewed.")
    return {"id": content_id, "reviewStatus": "rejected"}


@router.patch("/queue/{content_id}")
def edit_content(content_id: int, body: AdminContentEdit, admin: dict = Depends(require_admin), conn=Depends(get_conn)):
    fields = {k: v for k, v in body.model_dump().items() if v is not None}
    if not fields:
        raise HTTPException(status_code=400, detail="No fields to update.")
    import json
    if "key_changes" in fields:
        fields["key_changes"] = json.dumps(fields["key_changes"])
    set_clause = ", ".join(f"{k} = %({k})s" for k in fields)
    fields["id"] = content_id
    with conn.cursor() as cur:
        cur.execute(f"UPDATE bill_ai_content SET {set_clause} WHERE id = %(id)s RETURNING id", fields)
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Not found.")
    return {"id": content_id, "updated": list(fields.keys())}


# Whitelisted so sort_by can go straight into an f-string safely — never
# interpolate the raw query param itself.
ENTITY_SORT_COLUMNS = {
    "bill_number": "bill_number",
    "bill_name": "bill_name",
    "status": "status",
    "introduced_date": "introduced_date",
    "last_seen_at": "last_seen_at",   # recency — when ingestion last touched this bill
    "bill_type": "bill_type",
    "bill_category": "bill_category",
    "ministry_name": "ministry_name",
    # A blended score, not a single column — see the CASE expressions
    # below for exactly what it weighs and why.
    "priority": "priority_score",
}

# Same whitelist pattern as ENTITY_SORT_COLUMNS/AI_STATUS_VALUES — only
# these columns may be used to group rows, and only real categorical
# columns (not free-text ones like bill_name).
GROUP_BY_COLUMNS = {"bill_category", "bill_type", "ministry_name", "status"}

# Feeds priority_score — higher weight sorts first when sort_by=priority.
# These are the real category/status strings sansad.in uses; anything not
# listed falls through to the ELSE bucket rather than erroring, so a new
# unrecognized value degrades gracefully instead of breaking the sort.
#
# The single most important rule here is the `document_count = 0` guard in
# the scored CTE: a bill with no PDFs attached is pure metadata, there is
# nothing for either pipeline to process, so it scores 0 and sinks to the
# bottom regardless of how important its category looks. That's the actual
# "process the real bills first, skip the rest" behaviour.
_CATEGORY_WEIGHT_SQL = """
    CASE bill_category
        WHEN 'Constitution Amendment Bill' THEN 40
        WHEN 'Money Bill' THEN 35
        WHEN 'Financial Bill' THEN 30
        WHEN 'Ordinary Bill' THEN 20
        ELSE 15
    END
"""
_STATUS_WEIGHT_SQL = """
    CASE status
        WHEN 'Assented' THEN 15
        WHEN 'Passed' THEN 10
        WHEN 'Introduced' THEN 5
        WHEN 'Under Consideration' THEN 5
        WHEN 'Withdrawn' THEN 0
        WHEN 'Lapsed' THEN 0
        ELSE 3
    END
"""

# 'none' is a synthetic value meaning "no bill_ai_content row exists yet" —
# not a real review_status, so it needs its own branch in the WHERE clause
# below rather than a plain equality match.
AI_STATUS_VALUES = {"none", "generating", "pending_review", "approved", "rejected", "failed"}


@router.get("/entities")
def list_entities(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=200),
    sort_by: str = Query(default="last_seen_at"),
    sort_dir: str = Query(default="desc", pattern="^(asc|desc)$"),
    group_by: str = Query(default=None, description="bill_category | bill_type | ministry_name | status"),
    q: str = Query(default=None, description="Search bill number/name"),
    ai_status: str = Query(default=None, description="Filter by AI review status, or 'none' for unsummarized bills"),
    processed_only: bool = Query(default=False, description="Only bills with at least one extracted document"),
    has_documents: bool = Query(default=None, description="true: only bills with linked PDFs; false: only bills with none (nothing to process)"),
    admin: dict = Depends(require_admin), conn=Depends(get_conn),
):
    sort_col = ENTITY_SORT_COLUMNS.get(sort_by, "last_seen_at")
    offset = (page - 1) * page_size

    if ai_status is not None and ai_status not in AI_STATUS_VALUES:
        raise HTTPException(status_code=400, detail=f"ai_status must be one of {sorted(AI_STATUS_VALUES)}")
    if group_by is not None and group_by not in GROUP_BY_COLUMNS:
        raise HTTPException(status_code=400, detail=f"group_by must be one of {sorted(GROUP_BY_COLUMNS)}")

    params = {
        "limit": page_size, "offset": offset,
        "q": f"%{q}%" if q else None,
        "ai_status": ai_status,
        "processed_only": processed_only,
        "has_documents": has_documents,
    }

    where_sql = """
        (%(q)s::text IS NULL OR bill_name ILIKE %(q)s OR bill_number ILIKE %(q)s)
        AND (
            %(ai_status)s::text IS NULL
            OR (%(ai_status)s = 'none' AND ai_status IS NULL)
            OR ai_status = %(ai_status)s
        )
        AND (%(processed_only)s = false OR (document_count > 0 AND documents_extracted > 0))
        AND (
            %(has_documents)s::boolean IS NULL
            OR (%(has_documents)s = true AND document_count > 0)
            OR (%(has_documents)s = false AND document_count = 0)
        )
    """
    # Grouping just means "sort by the group column first" — rows for the
    # same group land contiguously so the frontend can render a header
    # whenever that field changes between consecutive rows, with no
    # separate grouped-response shape to maintain on either side.
    order_sql = f"{group_by} ASC NULLS LAST, {sort_col} {sort_dir.upper()} NULLS LAST, id DESC" if group_by \
        else f"{sort_col} {sort_dir.upper()} NULLS LAST, id DESC"

    with conn.cursor() as cur:
        cur.execute(f"""
            WITH agg AS (
                SELECT b.id, b.bill_number, b.bill_name, b.status, b.introduced_date, b.last_seen_at,
                       b.bill_type, b.bill_category, b.ministry_name,
                       count(bd.id) AS document_count,
                       count(bd.id) FILTER (WHERE bd.extraction_status = 'done') AS documents_extracted,
                       (SELECT ac.review_status FROM bill_ai_content ac
                        WHERE ac.bill_id = b.id ORDER BY ac.generated_at DESC LIMIT 1) AS ai_status
                FROM bills b LEFT JOIN bill_documents bd ON bd.bill_id = b.id
                GROUP BY b.id
            ),
            scored AS (
                SELECT *,
                       CASE WHEN document_count = 0 THEN 0
                            ELSE ({_CATEGORY_WEIGHT_SQL}) + ({_STATUS_WEIGHT_SQL})
                                 + (CASE WHEN documents_extracted > 0 AND documents_extracted < document_count THEN 5 ELSE 0 END)
                       END AS priority_score
                FROM agg
            )
            SELECT * FROM scored
            WHERE {where_sql}
            ORDER BY {order_sql}
            LIMIT %(limit)s OFFSET %(offset)s
        """, params)
        rows = cur.fetchall()

        # One extra query for every document belonging to bills on this
        # page — not one query per bill. Powers the "History" view and the
        # per-bill document action buttons (source PDF / extracted text)
        # without an N+1 fan-out as the page grows.
        bill_ids = [r["id"] for r in rows]
        docs_by_bill = {bid: [] for bid in bill_ids}
        if bill_ids:
            cur.execute("""
                SELECT id, bill_id, doc_type, source_url, storage_path,
                       extraction_status, extraction_method, page_count, error_message
                FROM bill_documents WHERE bill_id = ANY(%s) ORDER BY doc_type
            """, (bill_ids,))
            for doc in cur.fetchall():
                docs_by_bill[doc["bill_id"]].append({
                    "id": doc["id"], "docType": doc["doc_type"], "sourceUrl": doc["source_url"],
                    "extractionStatus": doc["extraction_status"], "extractionMethod": doc["extraction_method"],
                    "pageCount": doc["page_count"], "errorMessage": doc["error_message"],
                    "extractedTextUrl": as_text_url(doc["storage_path"]),
                })
        for r in rows:
            r["documents"] = docs_by_bill.get(r["id"], [])

        cur.execute(f"""
            WITH agg AS (
                SELECT b.id,
                       count(bd.id) AS document_count,
                       count(bd.id) FILTER (WHERE bd.extraction_status = 'done') AS documents_extracted,
                       b.bill_name, b.bill_number,
                       (SELECT ac.review_status FROM bill_ai_content ac
                        WHERE ac.bill_id = b.id ORDER BY ac.generated_at DESC LIMIT 1) AS ai_status
                FROM bills b LEFT JOIN bill_documents bd ON bd.bill_id = b.id
                GROUP BY b.id
            )
            SELECT count(*) AS total FROM agg WHERE {where_sql}
        """, params)
        total = cur.fetchone()["total"]

    return {"items": rows, "page": page, "page_size": page_size, "total": total,
            "sort_by": sort_by, "sort_dir": sort_dir, "group_by": group_by}


@router.get("/dashboard")
def dashboard(admin: dict = Depends(require_admin), conn=Depends(get_conn)):
    with conn.cursor() as cur:
        cur.execute("SELECT count(*) AS total FROM bills")
        total_bills = cur.fetchone()["total"]

        cur.execute("SELECT count(*) AS total FROM bill_ai_content WHERE review_status = 'pending_review'")
        queue_len = cur.fetchone()["total"]

        cur.execute("SELECT count(DISTINCT bill_id) AS total FROM bill_ai_content WHERE review_status = 'approved'")
        published = cur.fetchone()["total"]

        cur.execute("""
            SELECT b.bill_number, b.bill_name, b.status, b.last_seen_at
            FROM bills b ORDER BY b.last_seen_at DESC LIMIT 5
        """)
        recent = cur.fetchall()
    return {
        "totalBills": total_bills, "pendingReview": queue_len, "published": published,
        "recentActivity": recent,
    }
