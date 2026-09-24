# NationPulse V2 integration (September 2026)

This is an **updated source ZIP**, not a deployed application. Do not point it at your existing V1 database.

## Database
1. Back up the original database and keep it separate.
2. Your new empty V2 database must have been initialized with `nationpulse_v2_schema.sql` (included in `db/`).
3. Run `db/004_v2_runtime_indexes.sql` against V2 in pgAdmin. It adds active-job and AI-generation concurrency guards, and deduplicates house-less movements.
4. Copy each service's `.env.example` to `.env`, set `DATABASE_URL` to the new V2 database, and configure existing API/AI credentials locally. **Never include secrets in a shared ZIP.**
5. Install each service's dependencies from its `requirements.txt`; install frontend dependencies with `npm ci` in `apps/web`.
6. Start the API, then the frontend. Run `services/ingestion-layer/pipeline.py --no-trigger` to populate bills and source URLs; PDF and AI jobs remain admin-controlled.

## Changes
- Ingestion now uses the V2 canonical bill identity and retains original source observations, dated movements and changed PDF URLs as separate document versions.
- Admin API supports movement-based sorting, date/house filters, link-health filters and page sizes up to 500. The operational PDF queue is not a legislative importance ranking.
- `POST /admin/documents/{id}/check-link` and `POST /admin/bills/{id}/check-links?limit=10` verify source PDF URLs and record audit history; requests are restricted to approved parliamentary HTTPS hosts. Checks are synchronous and bounded; do not call them for thousands of documents at once.
- Admin UI adds link-health badges and per-document Check link buttons, server-side approved-bill pagination, configurable page sizes and movement filters.
- AI approval sets `published_at` and supersedes an older approved summary, matching the V2 one-approved-per-bill constraint.

## Known limitations / required local checks
- No connection to your local PostgreSQL instance is available here; database integration and real PDF URL checks must be run locally.
- This ZIP does **not** migrate old V1 rows, accounts or downloaded files. If you need those records, back up V1 and build a separate migration before deleting anything.
- Source bill identity can be ambiguous even when house/year/number match. Review `identity_review_required` and source observations for conflicts before trusting automated deduplication.
- Source API may include PDF hosts beyond the checker allowlist; add only verified official hosts to `api/routers/document_health.py`.
- Keep processing jobs admin-controlled; first run ingestion with `--no-trigger` and inspect bill/document counts.
- The existing UI and pipeline were not end-to-end tested against live V2/PostgreSQL or parliamentary sites here.
