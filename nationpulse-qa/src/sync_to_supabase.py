"""
sync_to_supabase.py
-------------------
Synchronizes Bill metadata from local CSV datasets into the Supabase 'qa_bills' table.

Usage:
    python src/sync_to_supabase.py --bills-csv data/raw/lok_sabha_bills.csv
    python src/sync_to_supabase.py --texts-csv data/lok_sabha_texts.csv
"""

import argparse
import csv
import os
import sys
from datetime import datetime
from typing import Dict, List, Any

_src_dir = os.path.abspath(os.path.dirname(__file__))
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)

from supabase_client import get_supabase_client, upsert_bills_batch, is_supabase_enabled


def parse_date(date_str: str) -> str | None:
    if not date_str or not date_str.strip():
        return None
    date_clean = date_str.split(" ")[0].strip()
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y"):
        try:
            return datetime.strptime(date_clean, fmt).strftime("%Y-%m-%d")
        except ValueError:
            pass
    return None


def sync_from_raw_csv(filepath: str, batch_size: int = 100) -> int:
    """Reads data/raw/lok_sabha_bills.csv and upserts into Supabase qa_bills table."""
    if not os.path.exists(filepath):
        print(f"Error: File not found: {filepath}")
        return 0

    records_by_id: Dict[str, Dict[str, Any]] = {}
    total_synced = 0

    print(f"Reading bill metadata from {filepath}...")
    with open(filepath, "r", encoding="utf-8-sig", errors="replace") as f:
        reader = csv.DictReader(f)
        for raw_row in reader:
            row = {k.lstrip("\ufeff").strip(): v for k, v in raw_row.items() if k}
            bill_num = (row.get("billNumber") or "").strip()
            bill_year = (row.get("billYear") or "").strip()
            bill_title = (row.get("billName") or "").strip()

            if not bill_title or not bill_num:
                continue

            bill_id = f"LS-{bill_year}-{bill_num}" if bill_year else f"LS-{bill_num}"

            record = {
                "bill_id": bill_id,
                "title": bill_title,
                "bill_number": bill_num,
                "bill_year": bill_year,
                "bill_type": (row.get("billType") or "").strip() or None,
                "bill_category": (row.get("billCategory") or "").strip() or None,
                "ministry": (row.get("ministryName") or "").strip() or None,
                "house": (row.get("billIntroducedInHouse") or "Lok Sabha").strip(),
                "status": (row.get("status") or "Introduced").strip(),
                "introduced_date": parse_date(row.get("billIntroducedDate")),
                "passed_ls_date": parse_date(row.get("billPassedInLSDate")),
                "passed_rs_date": parse_date(row.get("billPassedInRSDate")),
                "source_url": (row.get("billIntroducedFile") or "").strip() or None,
            }
            records_by_id[bill_id] = record  # later rows (revisions) win

    all_records = list(records_by_id.values())
    for i in range(0, len(all_records), batch_size):
        total_synced += upsert_bills_batch(all_records[i : i + batch_size])
        print(f"  Synced {total_synced} bills...")

    print(f"Done! Successfully synced {total_synced} bills to Supabase.")
    return total_synced


def sync_from_texts_csv(filepath: str, batch_size: int = 100) -> int:
    """Reads lok_sabha_texts.csv and extracts bill_id and title to upsert into Supabase."""
    if not os.path.exists(filepath):
        print(f"Error: File not found: {filepath}")
        return 0

    records_by_id: Dict[str, Dict[str, Any]] = {}
    seen_ids = set()
    total_synced = 0

    print(f"Reading bills from {filepath}...")
    with open(filepath, "r", encoding="utf-8-sig", errors="replace") as f:
        reader = csv.DictReader(f)
        for raw_row in reader:
            row = {k.lstrip("\ufeff").strip(): v for k, v in raw_row.items() if k}
            bill_id = (row.get("bill_id") or "").strip()
            bill_title = (row.get("bill_title") or "").strip()
            if not bill_id or not bill_title or bill_id in seen_ids:
                continue
            seen_ids.add(bill_id)

            records_by_id[bill_id] = {
                "bill_id": bill_id,
                "title": bill_title,
                "house": "Lok Sabha",
                "status": "Introduced",
            }

            if len(records_by_id) >= batch_size:
                count = upsert_bills_batch(list(records_by_id.values()))
                total_synced += count
                print(f"  Synced {total_synced} bills...")
                records_by_id.clear()

    if records_by_id:
        count = upsert_bills_batch(list(records_by_id.values()))
        total_synced += count

    print(f"Done! Successfully synced {total_synced} bills to Supabase.")
    return total_synced


def main():
    parser = argparse.ArgumentParser(description="Sync Bills to Supabase")
    parser.add_argument(
        "--bills-csv",
        default="data/raw/lok_sabha_bills.csv",
        help="Path to raw bills CSV with metadata",
    )
    parser.add_argument(
        "--texts-csv",
        help="Path to ingested bill texts CSV (e.g. data/lok_sabha_texts.csv)",
    )
    args = parser.parse_args()

    if not is_supabase_enabled():
        print("ERROR: Supabase is not configured.")
        print("Please set SUPABASE_URL and SUPABASE_SERVICE_KEY in the repository-root .env file.")
        sys.exit(1)

    if args.texts_csv:
        sync_from_texts_csv(args.texts_csv)
    else:
        sync_from_raw_csv(args.bills_csv)


if __name__ == "__main__":
    main()
