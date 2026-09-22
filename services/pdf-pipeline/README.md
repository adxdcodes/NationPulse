# Bill PDF extraction pipeline

Takes `bill_documents` rows (already populated by the sansad.in ingestion
step — `source_url` pointing at a PDF) and turns them into plain text:

    download PDF -> validate -> hash -> save raw PDF to storage
    -> extract text (pdfplumber -> PyMuPDF -> OCR fallback)
    -> save text to storage -> write results back to the DB row

This has been tested end-to-end in a sandbox: real Postgres, a generated
test PDF, extraction via pdfplumber, successful writes to both the DB and
the filesystem, plus the failure path (404 link -> retried, then marked
`failed` with a logged reason, without crashing the batch).

## Setup

```bash
pip install -r requirements.txt
cp .env.example .env        # edit DATABASE_URL etc.
psql "$DATABASE_URL" -f schema.sql
```

OCR fallback (for scanned PDFs with no text layer) additionally needs
system packages, not just the Python ones:

```bash
apt-get install -y tesseract-ocr poppler-utils
```

If you don't install these, leave `OCR_ENABLED=false` in `.env` — the
pipeline still runs fine, it just marks image-only PDFs as
`no_text_layer` instead of running OCR on them.

## Running

```bash
# process up to 50 pending documents once
python pipeline.py

# tune batch size / concurrency / filter to one doc type
python pipeline.py --limit 200 --workers 8 --doc-type introduced

# re-process rows that already succeeded (e.g. after improving the extractor)
python pipeline.py --force

# run forever as a background service, polling every 5 minutes
python pipeline.py --loop --interval 300

# scoped to exactly one bill — this is what the API's admin-triggered
# "Process" button actually calls
python pipeline.py --bill-id 42
```

The `--bill-id` flag exists for the admin-controlled processing flow (see
`api/routers/processing.py`) — an admin picks one bill in the frontend and
explicitly triggers extraction for just that bill, watching
`bill_documents` update live, with the ability to cancel a running job
(SIGTERM) mid-download. This replaced automatic ingestion-triggers-everything
as the default — see `ingestion/README.md`.

**This script no longer knows anything about `processing_jobs`.** Earlier
versions accepted a `--job-id` flag and self-reported their own status
into that table; that's gone. The API now tracks job status itself, by
watching this process's exit code from the parent side (see
`api/routers/processing.py` / `api/README.md`) — which is strictly more
robust, since it works even if this script crashes before it could have
self-reported anything (a bad argument, a missing dependency, any early
failure). This script's only job is: extract what it's told to extract,
and exit 0 on success / non-zero on failure. Nothing else needs to change
here for the API to correctly track that.

Run it as a systemd service or a Docker container with `--loop`, or drop
`python pipeline.py` (without `--loop`) into a cron job / GitHub Actions
schedule — both work fine since every run is safe to interrupt and re-run.

## How it stays correct under concurrency and re-runs

- **Claiming rows uses `FOR UPDATE SKIP LOCKED`** (`db.claim_pending_documents`),
  so you can run multiple `pipeline.py` processes at once (e.g. one per
  CPU core, or one per container) without two workers grabbing the same
  document.
- **Naming is content-hash-based**, not just bill-number-based:
  `raw/{year}/{house}/{bill_number}_{doc_type}_{hash8}.pdf` and the
  matching `.txt` file. Re-downloading unchanged content produces the same
  key (no duplicate storage); a genuinely revised PDF (e.g. a corrected
  reupload under the same URL) gets a new key instead of silently
  overwriting the old extraction.
- **Failures don't retry forever** — `download_attempts` increments on
  each failure and `error_message` is stored, so you can build a
  dead-letter view (`WHERE download_attempts > 5`) for anything that needs
  a human to look at the source URL.
- **`--force` re-processes done rows** without needing to hand-edit the DB
  first — useful after you improve the extractor and want better text for
  bills you already processed.

## Files

| File | Responsibility |
|---|---|
| `config.py` | Env-var configuration (DB URL, storage backend, retry/politeness settings) |
| `db.py` | Postgres access: claiming pending rows, recording success/failure |
| `storage.py` | Local-disk or S3 storage backend + the file naming convention |
| `downloader.py` | HTTP fetch with retries, backoff, and PDF-content validation |
| `extractor.py` | pdfplumber -> PyMuPDF -> OCR fallback chain |
| `pipeline.py` | CLI orchestrator — the thing you actually run |
| `schema.sql` | `bills` / `bill_documents` tables this pipeline reads and writes |

## What's next

This pipeline stops at plain text in the DB (`bill_documents.extracted_text`)
and on disk (`storage/text/...`). The next stage — feeding that text to
Claude to produce `summary` / `why_it_matters` / `key_changes` into
`bill_ai_content` for your admin review queue — is a separate worker that
polls `bill_documents WHERE extraction_status = 'done'`. Happy to build
that next.
