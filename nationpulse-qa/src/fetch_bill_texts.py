"""
fetch_bill_texts.py
--------------------
Downloads the actual Bill PDFs referenced in the normalized dataset
(nationpulse_bills_normalized.csv, or your raw lok_sabha_bills.csv /
rajya_sabha_bills.csv) from sansad.in, extracts their text, and writes
a bill_id, bill_title, bill_text CSV ready for ingest.py and the FLAN-T5
summarizer.

This sandbox environment cannot reach sansad.in directly (network is
restricted to a small allow-list), which is why sample_bill_texts.csv
only has 4 real Bills — fetched via search+fetch as a demonstration.
Run this script in your own environment (Colab, local machine, or your
deployment server) where sansad.in is reachable, and it will process
your full ~4,594-record dataset.

Usage:
    python fetch_bill_texts.py \
        --input ../nationpulse-summarizer/../bill-dataset-eda/nationpulse_bills_normalized.csv \
        --output ../data/all_bill_texts.csv \
        --url-column bill_introduced_file

Or point --input directly at the raw lok_sabha_bills.csv /
rajya_sabha_bills.csv (set --url-column billIntroducedFile and
--title-column billName in that case).
"""

import argparse
import io
import time

import pandas as pd
import requests
from pypdf import PdfReader

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
}


def fetch_pdf_text(url: str, timeout: int = 20, retries: int = 2) -> str:
    """Downloads a PDF from `url` and extracts its text. Returns '' on failure."""
    for attempt in range(retries + 1):
        try:
            resp = requests.get(url, headers=HEADERS, timeout=timeout)
            resp.raise_for_status()
            reader = PdfReader(io.BytesIO(resp.content))
            pages = [page.extract_text() or "" for page in reader.pages]
            return "\n".join(pages).strip()
        except Exception as e:
            if attempt == retries:
                print(f"  FAILED after {retries + 1} attempts: {url}\n    {e}")
                return ""
            time.sleep(1.5 * (attempt + 1))
    return ""


COMMON_COLUMN_ALIASES = {
    "year": ["billYear", "bill_year", "Year"],
    "number": ["billNumber", "bill_number", "Number"],
    "house": ["source_house", "sourceHouse", "House", "billIntroducedInHouse"],
}


def resolve_column(df, requested_col: str, kind: str) -> str | None:
    """Returns `requested_col` if it exists in df, otherwise tries known
    aliases for that kind of column (year/number/house), otherwise None.
    """
    if requested_col in df.columns:
        return requested_col
    for alias in COMMON_COLUMN_ALIASES.get(kind, []):
        if alias in df.columns:
            return alias
    return None


def build_bill_id(row, id_col: str, house_col: str | None, year_col: str | None, number_col: str | None) -> str:
    """Reconstructs the bill_id used by the EDA normalization step
    (HOUSE-YEAR-NUMBER), or falls back to an existing id_col if present.

    Raises if house/year/number can't be resolved, rather than silently
    producing a malformed id like "BILL--153" — malformed ids collide
    across different Bills from different years that happen to share a
    bill number, which silently corrupts the vector store on ingest
    (later upserts overwrite earlier chunks with the same colliding id).
    """
    if id_col and id_col in row.index and pd.notna(row[id_col]):
        return str(row[id_col])

    missing = [name for name, col in [("house", house_col), ("year", year_col), ("number", number_col)] if col is None]
    if missing:
        raise ValueError(
            f"Cannot build a unique bill_id: couldn't find column(s) for {missing} "
            f"in the input CSV, and no --id-column was found either. Pass the "
            f"correct column names explicitly, e.g. --year-column billYear "
            f"--number-column billNumber, or add a 'source_house' column "
            f"before running (see README), or point --input at the already-"
            f"normalized nationpulse_bills_normalized.csv instead, which has "
            f"correct bill_id / source_house / bill_year columns built in."
        )

    house = str(row.get(house_col, "")).strip()
    prefix = "LS" if "lok" in house.lower() else "RS" if "rajya" in house.lower() else "BILL"
    year = row.get(year_col, "")
    number = row.get(number_col, "")
    return f"{prefix}-{year}-{number}"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="Path to the source CSV")
    parser.add_argument("--output", required=True, help="Path to write bill_id,bill_title,bill_text CSV")
    parser.add_argument("--url-column", default="bill_introduced_file",
                         help="Column containing the PDF URL")
    parser.add_argument("--title-column", default="bill_title",
                         help="Column containing the Bill title")
    parser.add_argument("--id-column", default="bill_id",
                         help="Column containing a pre-built bill_id, if present")
    parser.add_argument("--house-column", default="source_house")
    parser.add_argument("--year-column", default="bill_year")
    parser.add_argument("--number-column", default="billNumber")
    parser.add_argument("--limit", type=int, default=None,
                         help="Only process the first N rows (useful for a test run)")
    parser.add_argument("--sleep", type=float, default=0.5,
                         help="Seconds to wait between requests (be polite to sansad.in)")
    args = parser.parse_args()

    df = pd.read_csv(args.input)

    # Resolve columns with fallback aliases (e.g. requested "bill_year" but
    # the CSV actually has "billYear") rather than silently treating a
    # missing column as blank, which produces malformed/colliding bill_ids.
    id_col = args.id_column if args.id_column in df.columns else None
    house_col = resolve_column(df, args.house_column, "house")
    year_col = resolve_column(df, args.year_column, "year")
    number_col = resolve_column(df, args.number_column, "number")

    print(f"Resolved columns — id: {id_col or '(not found, will build from house/year/number)'}, "
          f"house: {house_col or '(not found)'}, year: {year_col or '(not found)'}, "
          f"number: {number_col or '(not found)'}")

    if not id_col and not (house_col and year_col and number_col):
        raise ValueError(
            "Can't build unique bill_ids: no usable --id-column, and one or more "
            "of house/year/number columns couldn't be found. Check your CSV's "
            "actual column names and pass them explicitly, or use "
            "nationpulse_bills_normalized.csv as --input instead (see README)."
        )

    # Deduplicate input rows sharing the same identity BEFORE fetching, so
    # we don't waste a request re-downloading the same Bill's PDF twice
    # (raw datasets can contain the same Bill re-scraped at different
    # legislative stages — see the EDA step's duplicate-detection notes).
    dedup_keys = [c for c in [id_col, house_col, year_col, number_col] if c]
    if dedup_keys:
        before = len(df)
        df = df.drop_duplicates(subset=dedup_keys, keep="last")
        if len(df) < before:
            print(f"Dropped {before - len(df)} duplicate input rows "
                  f"(same {dedup_keys}) before fetching.")

    if args.limit:
        df = df.head(args.limit)

    results = []
    n_ok, n_fail, n_skip = 0, 0, 0
    seen_ids: set[str] = set()

    for i, row in df.iterrows():
        url = row.get(args.url_column)
        title = row.get(args.title_column, "Untitled Bill")

        if pd.isna(url) or not str(url).strip():
            n_skip += 1
            continue

        bill_id = build_bill_id(row, id_col, house_col, year_col, number_col)

        if bill_id in seen_ids:
            print(f"  Skipping {bill_id} ({str(title)[:50]}): duplicate bill_id "
                  f"already fetched this run.")
            n_skip += 1
            continue
        seen_ids.add(bill_id)

        print(f"[{i+1}/{len(df)}] Fetching {bill_id}: {str(title)[:60]}...")
        text = fetch_pdf_text(str(url))

        if text:
            results.append({"bill_id": bill_id, "bill_title": title, "bill_text": text})
            n_ok += 1
        else:
            n_fail += 1

        time.sleep(args.sleep)

    out_df = pd.DataFrame(results)

    dupe_ids = out_df["bill_id"].duplicated().sum() if len(out_df) else 0
    if dupe_ids:
        print(f"\nWARNING: {dupe_ids} duplicate bill_id(s) still present in output — "
              f"this should not happen and means two different Bills produced the "
              f"same id. Do not ingest this file until resolved, as it will silently "
              f"overwrite chunks in the vector store.")

    out_df.to_csv(args.output, index=False)

    print(f"\nDone. {n_ok} succeeded, {n_fail} failed, {n_skip} skipped (no URL or duplicate).")
    print(f"Wrote {len(out_df)} rows to {args.output}")
    if n_fail:
        print("Failed fetches are usually due to renamed/moved PDFs on sansad.in — "
              "you can re-run with a smaller --limit to retry just those rows, "
              "or fall back to PRS India (prsindia.org) mirrors for specific Bills.")


if __name__ == "__main__":
    main()
