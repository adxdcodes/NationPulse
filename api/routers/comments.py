from fastapi import APIRouter, Depends, HTTPException

from db import get_conn
from auth import require_user
from models import CommentCreate

router = APIRouter(tags=["comments"])


@router.get("/bills/{bill_id}/comments")
def list_comments(bill_id: int, conn=Depends(get_conn)):
    with conn.cursor() as cur:
        cur.execute("""
            SELECT c.id, c.body, c.created_at, u.id AS author_id, u.name AS author_name
            FROM comments c JOIN users u ON u.id = c.user_id
            WHERE c.bill_id = %s ORDER BY c.created_at ASC
        """, (bill_id,))
        rows = cur.fetchall()
    return {"items": [
        {"id": r["id"], "body": r["body"], "createdAt": r["created_at"].isoformat(),
         "authorId": r["author_id"], "authorName": r["author_name"]}
        for r in rows
    ]}


@router.post("/bills/{bill_id}/comments", status_code=201)
def create_comment(bill_id: int, body: CommentCreate, user: dict = Depends(require_user), conn=Depends(get_conn)):
    with conn.cursor() as cur:
        cur.execute("SELECT 1 FROM bills WHERE id = %s", (bill_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Bill not found.")
        cur.execute(
            "INSERT INTO comments (bill_id, user_id, body) VALUES (%s, %s, %s) RETURNING id, created_at",
            (bill_id, user["id"], body.body.strip()),
        )
        row = cur.fetchone()
    return {"id": row["id"], "body": body.body.strip(), "createdAt": row["created_at"].isoformat(),
            "authorId": user["id"], "authorName": user["name"]}


@router.delete("/comments/{comment_id}", status_code=204)
def delete_comment(comment_id: int, user: dict = Depends(require_user), conn=Depends(get_conn)):
    with conn.cursor() as cur:
        cur.execute("SELECT user_id FROM comments WHERE id = %s", (comment_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Comment not found.")
        if row["user_id"] != user["id"] and not user["is_admin"]:
            raise HTTPException(status_code=403, detail="You can only delete your own comments.")
        cur.execute("DELETE FROM comments WHERE id = %s", (comment_id,))
