from fastapi import APIRouter, Depends, HTTPException

from auth import require_user
from db import get_conn
from models import BillReactionCreate

router = APIRouter(tags=["bill engagement"])


def _snapshot(cur, bill_id: int, user_id: int):
    cur.execute(
        """
        SELECT
          (SELECT count(*) FROM bill_reactions WHERE bill_id = %s AND reaction = 'like') AS likes,
          (SELECT count(*) FROM bill_reactions WHERE bill_id = %s AND reaction = 'dislike') AS dislikes,
          (SELECT count(*) FROM bill_views WHERE bill_id = %s) AS views,
          (SELECT reaction FROM bill_reactions WHERE bill_id = %s AND user_id = %s) AS reaction
        """,
        (bill_id, bill_id, bill_id, bill_id, user_id),
    )
    row = cur.fetchone()
    return {
        "likes": row["likes"],
        "dislikes": row["dislikes"],
        "views": row["views"],
        "reaction": row["reaction"],
    }


def _require_bill(cur, bill_id: int):
    cur.execute(
        """
        SELECT 1 FROM bills b
        WHERE b.id = %s AND EXISTS (
          SELECT 1 FROM bill_ai_content ac
          WHERE ac.bill_id = b.id AND ac.review_status = 'approved'
        )
        """,
        (bill_id,),
    )
    if not cur.fetchone():
        raise HTTPException(status_code=404, detail="Bill not found.")


@router.get("/bills/{bill_id}/engagement")
def get_bill_engagement(bill_id: int, user: dict = Depends(require_user), conn=Depends(get_conn)):
    with conn.cursor() as cur:
        _require_bill(cur, bill_id)
        return _snapshot(cur, bill_id, user["id"])


@router.post("/bills/{bill_id}/view")
def record_bill_view(bill_id: int, user: dict = Depends(require_user), conn=Depends(get_conn)):
    with conn.cursor() as cur:
        _require_bill(cur, bill_id)
        # Count one view per signed-in reader, avoiding inflated totals from reloads.
        cur.execute(
            "INSERT INTO bill_views (bill_id, user_id) VALUES (%s, %s) ON CONFLICT DO NOTHING",
            (bill_id, user["id"]),
        )
        return _snapshot(cur, bill_id, user["id"])


@router.post("/bills/{bill_id}/reaction")
def set_bill_reaction(bill_id: int, body: BillReactionCreate, user: dict = Depends(require_user), conn=Depends(get_conn)):
    with conn.cursor() as cur:
        _require_bill(cur, bill_id)
        cur.execute(
            "SELECT reaction FROM bill_reactions WHERE bill_id = %s AND user_id = %s",
            (bill_id, user["id"]),
        )
        current = cur.fetchone()
        if current and current["reaction"] == body.reaction:
            cur.execute("DELETE FROM bill_reactions WHERE bill_id = %s AND user_id = %s", (bill_id, user["id"]))
        else:
            cur.execute(
                """
                INSERT INTO bill_reactions (bill_id, user_id, reaction)
                VALUES (%s, %s, %s)
                ON CONFLICT (bill_id, user_id)
                DO UPDATE SET reaction = EXCLUDED.reaction, updated_at = now()
                """,
                (bill_id, user["id"], body.reaction),
            )
        return _snapshot(cur, bill_id, user["id"])
