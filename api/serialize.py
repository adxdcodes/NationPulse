"""Turns a joined bills+bill_ai_content DB row into the shape the frontend's
EVENT objects already use (see nation-pulse/src/data/mockData.js) — kept in
one place so bills.py, topics.py, and admin.py never drift apart on this.
"""
from status_map import normalize_status, compute_stage, STAGES


def serialize_bill(row: dict, comment_count: int = None) -> dict:
    stage = compute_stage(row)
    key_changes = row.get("key_changes") or []

    out = {
        "id": row["bill_id"] if "bill_id" in row else row["id"],
        # Hardcoded for now — every ingested record today is a Parliament
        # bill. See README "Suggested changes" for what adding Executive/
        # Budget/Judiciary sources would take.
        "domain": "Parliament",
        "status": normalize_status(row["status"]),
        "rawStatus": row["status"],
        "topic": row.get("topic"),
        "ministry": row.get("ministry_name"),
        "date": row["introduced_date"].isoformat() if row.get("introduced_date") else None,
        "title": row.get("plain_title") or row["bill_name"],
        "officialTitle": row["bill_name"],
        "billNumber": row["bill_number"],
        "billYear": row.get("bill_year"),
        "house": row.get("introduced_house"),
        "summary": row.get("summary"),
        "why": row.get("why_it_matters"),
        "stages": STAGES,
        "stage": stage,
        "amend": bool(key_changes),
        "changes": key_changes,
        "confidenceNotes": row.get("confidence_notes"),
        # Not sourced yet — no Budget ingestion exists. Frontend already
        # renders these conditionally (`ev.allocation &&`), so leaving them
        # null requires no frontend change.
        "allocation": None,
        "utilised": None,
        "sponsors": [],  # populated once bill_sponsors has data (MP ingestion — see README)
    }
    if comment_count is not None:
        out["commentCount"] = comment_count
    return out
