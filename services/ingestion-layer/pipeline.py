"""Ingestion entrypoint. Per house:

    1. Fetch the full bill list.
    2. Compare its length against the last known total (ingestion_state).
    3. Upsert every bill + its documents (cheap, idempotent either way).
    4. Determine which bills were genuinely new (Postgres tells us this
       directly via the insert-vs-update RETURNING trick — see db.py).
    5. Store the new total.
    6. If anything new showed up, optionally trigger the PDF + AI pipelines.

Usage:
    python pipeline.py                  # both houses
    python pipeline.py --house rs       # just Rajya Sabha
    python pipeline.py --dry-run        # fetch + compare, write nothing
    python pipeline.py --no-trigger     # skip the downstream pipelines this run
"""
import argparse
import logging

import config
import db
from fetch import fetch_house_bills, FetchError
from trigger import run_downstream

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("ingestion")

HOUSE_ALIASES = {"rs": "Rajya Sabha", "ls": "Lok Sabha"}


def process_house(house_cfg: dict, dry_run: bool) -> int:
    house, endpoint, size = house_cfg["house"], house_cfg["endpoint"], house_cfg["size"]

    try:
        raw_rows = fetch_house_bills(house, endpoint, size)
    except FetchError as e:
        log.error("[%s] fetch failed: %s", house, e)
        with db.get_conn() as conn:
            db.update_state(conn, house, get_prev_total(conn, house), 0, "error", str(e))
        return 0

    new_total = len(raw_rows)

    with db.get_conn() as conn:
        old_total = db.get_last_total(conn, house)
        delta = new_total - old_total

        if new_total < old_total:
            log.warning(
                "[%s] total DROPPED from %d to %d — a bill may have been withdrawn, "
                "renumbered, or the API changed shape. Investigate before trusting counts.",
                house, old_total, new_total,
            )
        elif delta > 0:
            log.info("[%s] total rose from %d to %d (+%d) — checking which bills are actually new.",
                      house, old_total, new_total, delta)
        else:
            log.info("[%s] total unchanged at %d.", house, new_total)

        if dry_run:
            log.info("[%s] --dry-run: not writing to the database.", house)
            return 0

        results = db.upsert_bills(conn, raw_rows)
        new_bills = [r for r in results if r["inserted"]]

        for r in new_bills:
            db.upsert_documents(conn, r["id"], r["raw"])

        # Also refresh documents for existing bills (a bill's report/errata
        # file can appear after the bill itself was first seen).
        for r in results:
            if not r["inserted"]:
                db.upsert_documents(conn, r["id"], r["raw"])

        status = "warning" if new_total < old_total else "ok"
        note = f"{len(new_bills)} newly inserted bill(s) this run"
        db.update_state(conn, house, new_total, len(new_bills), status, note)

        if len(new_bills) != max(delta, 0):
            log.info(
                "[%s] note: count delta was %d but %d rows were actually new inserts — "
                "this is expected if an existing bill's status/date changed without the "
                "list length changing, or vice versa. The insert-based number is the "
                "trustworthy one.", house, delta, len(new_bills),
            )

        for r in new_bills:
            log.info("[%s] NEW: %s — %s", house, r["bill_number"], r["raw"].get("billName", "")[:70])

        return len(new_bills)


def get_prev_total(conn, house: str) -> int:
    return db.get_last_total(conn, house)


def main():
    parser = argparse.ArgumentParser(description="sansad.in bill ingestion")
    parser.add_argument("--house", choices=["rs", "ls", "both"], default="both")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--no-trigger", action="store_true", help="Skip triggering downstream pipelines this run")
    args = parser.parse_args()

    houses = config.HOUSES
    if args.house != "both":
        target = HOUSE_ALIASES[args.house]
        houses = [h for h in houses if h["house"] == target]

    total_new = 0
    for house_cfg in houses:
        total_new += process_house(house_cfg, args.dry_run)

    log.info("Run complete: %d new bill(s) across %d house(s).", total_new, len(houses))

    if not args.dry_run and not args.no_trigger:
        run_downstream(total_new)


if __name__ == "__main__":
    main()
