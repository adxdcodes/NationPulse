from fastapi import APIRouter, Depends, HTTPException
from psycopg2 import errors as pg_errors

from db import get_conn
from auth import require_user
from models import FollowCreate

router = APIRouter(tags=["follows"])


@router.get("/me/follows")
def list_my_follows(user: dict = Depends(require_user), conn=Depends(get_conn)):
    with conn.cursor() as cur:
        cur.execute("SELECT kind, target_id FROM follows WHERE user_id = %s", (user["id"],))
        rows = cur.fetchall()
    out = {"bill": [], "topic": [], "mp": []}
    for r in rows:
        out[r["kind"]].append(r["target_id"])
    return out


@router.post("/follows", status_code=201)
def follow(body: FollowCreate, user: dict = Depends(require_user), conn=Depends(get_conn)):
    with conn.cursor() as cur:
        try:
            cur.execute(
                "INSERT INTO follows (user_id, kind, target_id) VALUES (%s, %s, %s) ON CONFLICT DO NOTHING",
                (user["id"], body.kind, body.target_id),
            )
        except pg_errors.ForeignKeyViolation:
            raise HTTPException(status_code=400, detail="Invalid follow target.")
    return {"kind": body.kind, "targetId": body.target_id, "following": True}


@router.delete("/follows/{kind}/{target_id}")
def unfollow(kind: str, target_id: str, user: dict = Depends(require_user), conn=Depends(get_conn)):
    with conn.cursor() as cur:
        cur.execute(
            "DELETE FROM follows WHERE user_id = %s AND kind = %s AND target_id = %s",
            (user["id"], kind, target_id),
        )
    return {"kind": kind, "targetId": target_id, "following": False}
