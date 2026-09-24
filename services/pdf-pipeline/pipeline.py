"""Orchestrates: claim pending bill_documents -> download PDF -> extract
text -> save raw PDF + text file to storage -> write results back to DB.

Usage:
    python pipeline.py                       # process up to 50 pending docs
    python pipeline.py --limit 200 --workers 8
    python pipeline.py --doc-type introduced # only this document type
    python pipeline.py --force               # re-process even 'done' rows
    python pipeline.py --loop --interval 300 # run continuously, poll every 5 min
"""
import argparse
import logging
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

import config
import db
from downloader import download_pdf, DownloadError
from extractor import extract_text
from storage import get_storage, build_key, sha256_bytes

from log_setup import configure
log = configure("pdf_pipeline")


def process_one(row: dict, storage):
    doc_id = row["doc_id"]

    try:
        pdf_bytes = download_pdf(row["source_url"])
    except DownloadError as e:
        with db.get_conn() as conn:
            db.mark_failed(conn, doc_id, str(e))
        return doc_id, False, f"download failed: {e}"

    # Only mark extracting after download succeeds.
    with db.get_conn() as conn:
        db.mark_extracting(conn, doc_id)

    file_hash = sha256_bytes(pdf_bytes)

    raw_key = build_key(
        bill_year=row["bill_year"], introduced_house=row["introduced_house"],
        bill_number=row["bill_number"], doc_type=row["doc_type"],
        file_hash=file_hash, ext="pdf",
    )
    raw_path = storage.save("raw", raw_key, pdf_bytes)

    try:
        result = extract_text(pdf_bytes)
    except Exception as e:
        with db.get_conn() as conn:
            db.mark_failed(conn, doc_id, f"extraction crashed: {e}")
        return doc_id, False, f"extraction crashed: {e}"

    text_key = build_key(
        bill_year=row["bill_year"], introduced_house=row["introduced_house"],
        bill_number=row["bill_number"], doc_type=row["doc_type"],
        file_hash=file_hash, ext="txt",
    )
    storage.save("text", text_key, result.text)

    with db.get_conn() as conn:
        db.mark_success(
            conn, doc_id,
            storage_path=raw_path, file_hash=file_hash, file_size_bytes=len(pdf_bytes),
            extracted_text=result.text, extraction_method=result.method,
            page_count=result.page_count, no_text_layer=result.no_text_layer,
        )

    flag = " (no text layer, used OCR)" if result.no_text_layer and result.method == "ocr" else ""
    return doc_id, True, f"{row['bill_number']} / {row['doc_type']} -> {result.method}, {len(result.text)} chars{flag}"


def run_batch(limit: int, doc_type: str | None, force: bool, workers: int, bill_id: int | None = None) -> int:
    storage = get_storage()
    with db.get_conn() as conn:
        rows = db.claim_pending_documents(conn, limit=limit, doc_type=doc_type, force=force, bill_id=bill_id)

    if not rows:
        log.info("No pending documents to process.")
        return 0

    log.info("Claimed %d document(s) for processing.", len(rows))
    ok, failed = 0, 0

    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(process_one, row, storage): row for row in rows}
        for future in as_completed(futures):
            doc_id, success, message = future.result()
            if success:
                ok += 1
                log.info("[doc %s] OK — %s", doc_id, message)
            else:
                failed += 1
                log.warning("[doc %s] FAILED — %s", doc_id, message)

    log.info("Batch complete: %d succeeded, %d failed.", ok, failed)
    return len(rows)


def main():
    parser = argparse.ArgumentParser(description="Bill PDF extraction pipeline")
    parser.add_argument("--limit", type=int, default=50, help="Max documents to claim per batch")
    parser.add_argument("--workers", type=int, default=config.WORKER_THREADS)
    parser.add_argument("--doc-type", default=None, help="Only process this bill_doc_type")
    parser.add_argument("--force", action="store_true", help="Re-process even already-done documents")
    parser.add_argument("--loop", action="store_true", help="Run continuously instead of once")
    parser.add_argument("--interval", type=int, default=300, help="Seconds between polls when --loop")
    parser.add_argument("--bill-id", type=int, default=None, help="Process only this bill_id")
    parser.add_argument("--job-id", type=int, default=None, help="Admin job id for tracking")
    args = parser.parse_args()

    if args.bill_id is not None:
        processed = run_batch(
            args.limit,
            args.doc_type,
            args.force,
            args.workers,
            bill_id=args.bill_id
        )

        if processed == 0:
            log.error(
                "No eligible PDF documents for bill %s",
                args.bill_id
            )
            raise SystemExit(1)

    return

    if args.loop:
        log.info("Starting in loop mode, polling every %ds.", args.interval)
        while True:
            processed = run_batch(args.limit, args.doc_type, args.force, args.workers)
            time.sleep(args.interval if processed == 0 else 1)
    else:
        run_batch(args.limit, args.doc_type, args.force, args.workers)


if __name__ == "__main__":
    main()
