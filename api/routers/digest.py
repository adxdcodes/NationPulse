"""Weekly digest, computed on the fly by grouping approved bills into ISO
weeks by their most recent change. There's no editorial curation table
(admin hand-picking highlights) yet — see README "Suggested changes" for
why you'll probably want one once there's enough volume that "everything
that changed this week" stops being a good enough digest on its own.
"""
from fastapi import APIRouter, Depends, Query

from db import get_conn
from serialize import serialize_bill

router = APIRouter(tags=["digest"])


@router.get("/digest")
def get_digest(weeks: int = Query(default=6, ge=1, le=26), conn=Depends(get_conn)):
    with conn.cursor() as cur:
        cur.execute("""
            WITH approved_content AS (
                SELECT DISTINCT ON (bill_id) *
                FROM bill_ai_content WHERE review_status = 'approved'
                ORDER BY bill_id, generated_at DESC
            )
            SELECT b.*, ac.plain_title, ac.summary, ac.why_it_matters, ac.topic, ac.key_changes,
                   date_trunc('week', b.last_changed_at) AS week_start
            FROM bills b JOIN approved_content ac ON ac.bill_id = b.id
            WHERE b.last_changed_at >= now() - (%(weeks)s || ' weeks')::interval
            ORDER BY week_start DESC, b.last_changed_at DESC
        """, {"weeks": weeks})
        rows = cur.fetchall()

    editions = {}
    for row in rows:
        key = row["week_start"].date().isoformat()
        editions.setdefault(key, []).append(row)

    items = []
    for week_start, bills in sorted(editions.items(), reverse=True):
        items.append({
            "id": week_start,
            "label": f"Week of {week_start}",
            "stat": {"label": "Bills updated this week", "value": len(bills)},
            "highlights": [serialize_bill({**b, "bill_id": b["id"]}) for b in bills[:5]],
        })
    return {"items": items}
