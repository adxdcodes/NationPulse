# Bill ingestion service

Fetches every bill from sansad.in's two known endpoints (Rajya Sabha and
Lok Sabha), detects genuinely new bills, and chains straight into the PDF
and AI pipelines so a newly-published bill ends up as an approvable AI
summary in one run — with zero manual steps in between.

This has been tested end-to-end for real: a fake sansad.in server serving
the exact JSON shape from the real API, chained into the actual
`pdf-pipeline` and `ai-pipeline` services (not mocks — the real code from
those two repos). Verified across three runs:
1. First run: 3 bills discovered → 8 PDFs downloaded/extracted → 3 AI
   summaries generated, all landing in `bill_ai_content` as `pending_review`.
2. Second run, nothing changed on the source: correctly reports 0 new
   bills and skips triggering the downstream pipelines entirely.
3. One new bill published on the source: correctly detects the count rose
   by exactly 1, identifies *which* bill is new (not just "one more than
   last time"), and only that bill's document flows through extraction
   and summarization.

## How "is anything new" is decided

Two signals, not one:

1. **The count you described** — `ingestion_state` stores `last_total_bills`
   per house. Every run compares the freshly-fetched list length against
   it. This is the cheap "should I even look closer" signal, and it's
   also a good sanity alarm: if the count ever *drops*, something
   unusual happened upstream (a bill withdrawn, renumbered, or the API's
   shape changed) and it's logged as a warning rather than silently
   absorbed.

2. **Insert-vs-update detection on the actual upsert** — this is the
   hardening layer I'd add on top of pure count-comparison (see
   "Improvements" below for why). Every bill is upserted regardless, and
   Postgres tells us directly which rows were genuinely new via
   `RETURNING (xmax = 0) AS inserted` — a well-known trick where `xmax = 0`
   on a returned row means this exact statement inserted it, not updated
   an existing one. That's the number actually used to decide what to
   push downstream, not the raw count delta.

## Setup

```bash
pip install -r requirements.txt
cp .env.example .env        # edit DATABASE_URL, PDF_PIPELINE_DIR, AI_PIPELINE_DIR
psql "$DATABASE_URL" -f schema.sql
```

`PDF_PIPELINE_DIR` and `AI_PIPELINE_DIR` should point at the other two
services (absolute paths are safest — see the note below on relative
paths and `subprocess` cwd).

## Running

```bash
python pipeline.py                  # both houses, chains into PDF + AI pipelines
python pipeline.py --house rs       # just Rajya Sabha
python pipeline.py --dry-run        # fetch + compare only, writes nothing
python pipeline.py --no-trigger     # ingest, but don't chain downstream this run
```

Run this on a schedule (cron / systemd timer / GitHub Actions) — hourly or
even every 15 minutes is fine. Bill status changes are not a fast-moving
target, and every run is cheap: one HTTP request per house, then only as
much downstream work as there are actually new bills.

## Why sansad.in gets fetched in full every time, not paginated

The `size` params you found (`1020`, `3574`) return the entire list in one
page — this isn't incremental pagination, it's "ask for everything." That's
fine at this scale (thousands of bills, not millions) and it's what makes
the count-comparison trick work in the first place: you can't compare
"total on the server" against "total last seen" if you're only ever
looking at a fixed-size window of it. If sansad.in ever returns a
`totalElements`-style wrapper instead of a bare array, `fetch.py` already
handles both shapes — worth double-checking against the live response
once you're pointed at the real domain.

## Improvements over the pure count-delta approach

The count check alone is a reasonable trigger but has one gap: **it only
tells you production went up by N, not which N bills those are.** If you
tried to assume "the newest N by position are the new ones," a few real
scenarios would quietly break that assumption:

- Two bills published, one withdrawn same day → count only rose by 1, but
  there are 2 new bills to process, not 1.
- A bill's status changes (e.g. Introduced → Passed) without any count
  change at all → count-only logic would never notice it needs
  `bill_documents` refreshed for a newly-appeared "passed" PDF link.
- The API's default sort behavior isn't something you control — if it
  ever changes tiebreaking for same-day bills, "top N" stops being a safe
  assumption.

Because this service upserts every bill on every run anyway (it's cheap —
JSON only, no PDFs at this stage) and lets Postgres tell it exactly which
rows were real inserts, none of the above can cause a missed bill. The
count check stays as the fast "did anything change" signal and the
cheap alarm for anomalies; the actual "what's new" answer never depends
on trusting sort order or arithmetic on two numbers.

**Other things worth adding as this matures:**
- **Alerting on `last_run_status = 'warning'`** (the count-dropped case) —
  right now it's just a log line; wiring it to a Slack/email alert means
  a genuinely unusual event doesn't get missed between manual checks.
- **Per-house independent scheduling** — Lok Sabha and Rajya Sabha don't
  publish on the same cadence; running them as separate cron entries
  (`--house rs`, `--house ls`) lets you tune frequency independently
  instead of always paying for both in one run.
- **A `billType` sweep** — right now (matching the URLs you found)
  `billType=Government` is hardcoded in `fetch.py`. sansad.in almost
  certainly has the same endpoint for Private Member bills; worth
  confirming whether you want those tracked too.
- **Backoff on `TRIGGER_DOWNSTREAM`** — right now a failed PDF/AI
  subprocess just logs a warning and moves on; for a production
  scheduler, failed downstream runs should probably retry on the *next*
  scheduled ingestion run automatically, which they already will (failed
  `bill_documents`/`bill_ai_content` rows stay in a re-claimable state) —
  just worth confirming that's the behavior you want rather than a
  same-run retry.

## Files

| File | Responsibility |
|---|---|
| `config.py` | Env-var configuration, including the two house endpoint configs |
| `fetch.py` | Hits the real endpoints, handles both bare-array and wrapped response shapes |
| `normalize.py` | Field mapping, mixed-date-format parsing, whitespace trimming |
| `db.py` | Upserts + the insert-vs-update detection trick + `ingestion_state` bookkeeping |
| `trigger.py` | Chains into the PDF and AI pipelines via subprocess when new bills appear |
| `pipeline.py` | CLI orchestrator — the thing you actually run |
| `schema.sql` | `bills` / `bill_documents` (shared with the other services) + `ingestion_state` |
| `dev/fake_sansad_server.py` | Test double used to verify this end-to-end without hitting the real site |
