"""MP directory + profile. Returns real rows once an MP-ingestion service
exists (see README "Suggested next steps") — until then this is an empty
list, not mock data, so the frontend can tell the difference between
"no MPs yet" and "MPs exist but none match your filter."
"""
from fastapi import APIRouter, Depends, HTTPException, Query

from db import get_conn

router = APIRouter(tags=["mps"])


def _serialize_mp(row: dict) -> dict:
    return {
        "id": row["id"], "name": row["name"], "house": row["house"], "state": row["state"],
        "constituency": row["constituency"], "party": row["party"], "bloc": row["bloc"],
        "term": row["term"], "terms": row["terms"], "education": row["education"],
        "committee": row["committee"], "topics": row["topics"] or [], "bio": row["bio"],
        "stats": {
            "billsSponsored": row["bills_sponsored"], "questionsAsked": row["questions_asked"],
            "attendance": row["attendance_pct"], "debates": row["debates_count"],
        },
    }


@router.get("/mps")
def list_mps(q: str = Query(default=None), house: str = Query(default=None), conn=Depends(get_conn)):
    where, params = ["true"], {}
    if q:
        where.append("(name ILIKE %(q)s OR state ILIKE %(q)s OR constituency ILIKE %(q)s)")
        params["q"] = f"%{q}%"
    if house and house != "All":
        where.append("house = %(house)s")
        params["house"] = house

    with conn.cursor() as cur:
        cur.execute(f"SELECT * FROM mps WHERE {' AND '.join(where)} ORDER BY name", params)
        rows = cur.fetchall()
    return {"items": [_serialize_mp(r) for r in rows]}


@router.get("/mps/{mp_id}")
def get_mp(mp_id: int, conn=Depends(get_conn)):
    with conn.cursor() as cur:
        cur.execute("SELECT * FROM mps WHERE id = %s", (mp_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="MP not found.")
    return _serialize_mp(row)
