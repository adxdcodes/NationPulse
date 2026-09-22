# NationPulse API

The service that connects the three backend pipelines (ingestion,
pdf-pipeline, ai-pipeline) to the frontend. FastAPI, same Postgres
database as everything else, real JWT auth, real bcrypt password hashing.

This has been tested end to end for real — not just unit-tested in
isolation. I ran the actual ingestion → pdf-pipeline → ai-pipeline chain
from before, then started this API against that same database and, over
real HTTP requests to a real running server:

- Confirmed `/bills` returns **zero** results while everything sits in
  `pending_review` — the public/admin gate works.
- Signed up a real user, promoted them to admin, logged in, got a real JWT.
- Called `/admin/queue` and saw the actual 4 bills from the ingestion test.
- Approved one bill and confirmed it immediately appeared on `/bills` with
  correctly derived `status` ("Assented" → "In Effect") and `stage` (5,
  because `act_no` was present).
- Fetched `/bills/1` and got the real extracted-PDF storage paths back
  from `bill_documents`.
- Posted a real comment, followed a bill, and listed both back.
- Confirmed posting a comment **without** a token returns 401.

## Setup

```bash
pip install -r requirements.txt
cp .env.example .env        # edit DATABASE_URL, JWT_SECRET, CORS_ORIGINS
psql "$DATABASE_URL" -f schema.sql    # adds users/comments/follows/mps on top of the pipeline tables
uvicorn main:app --reload --port 8000
```

Your first admin: sign up normally through `/auth/signup`, then run
`UPDATE users SET is_admin = true WHERE email = '...'` once by hand. There's
deliberately no "become admin" API endpoint.

## The one rule that matters most: what "public" means

Every public endpoint (`/bills`, `/bills/{id}`, `/topics`, `/digest`) joins
against the **latest `bill_ai_content` row with `review_status = 'approved'`**
and nothing else. A bill with only a `pending_review` draft does not exist
as far as an unauthenticated visitor is concerned — not hidden, not
filtered out, genuinely a 404. The admin router (`/admin/queue`, etc.) is
the only place `pending_review` content is visible. This is what makes the
whole three-pipeline system safe to run unattended: ingestion, extraction,
and AI drafting can fire continuously, and nothing reaches the public site
until a human clicks Approve.

## Suggested changes — read this before rebuilding the frontend

The frontend's mock `EVENT`/`MP` shapes were invented before real data
existed, so a few things don't map cleanly. I kept the API's response
shapes as close to the existing mock objects as I could (see `serialize.py`)
so most components need **zero** changes, but these do need a decision:

1. **`domain` is always `"Parliament"` right now.** There's no Executive,
   Budget, or Judiciary ingestion built — only the sansad.in bills feed.
   The frontend's domain filter chips (Parliament/Executive/Budget/
   Judiciary) will work, but three of them will always show empty results
   until those sources exist. Either build those ingestion sources next,
   or simplify the filter UI until they do — your call.

2. **`/mps` returns an empty list.** The `mps` table exists (so follow-an-MP
   and the directory page are wired end to end already) but nothing
   populates it. sansad.in almost certainly has a members list endpoint
   alongside the bills one — same DevTools-discovery approach as before
   would find it. Worth doing before the MP directory page is rebuilt,
   otherwise it's an empty page.

3. **The admin edit form should change shape.** The old mock admin let you
   edit a bill's title, domain, status, ministry, date — treating the
   whole thing as one flat, freely-editable record. In the real system,
   those are **facts from sansad.in** and shouldn't be hand-edited by a
   moderator (they'd just get overwritten on the next ingestion run
   anyway). Only `AdminContentEdit` fields are editable now — `summary`,
   `why_it_matters`, `topic`, `key_changes`, `plain_title` — i.e. the
   AI-generated interpretive layer, not the source-of-truth bill record.
   The admin UI's "Edit" modal needs to reflect that narrower, more
   honest scope.

4. **Admin auth is now a real per-user role**, not the shared "password is
   'admin'" mock. `AdminLogin.jsx` goes away entirely — admin becomes a
   normal `/auth/login` plus a route guard checking `user.isAdmin`, same
   as any other role-gated route.

5. **Budget bills (`allocation`/`utilised`) have no data source.** The
   frontend already renders these conditionally, so this needs no
   frontend change — just know those fields will always be `null` until
   a Budget-document ingestion source exists.

6. **Digest is computed, not curated.** `/digest` groups approved bills by
   ISO week of last change — there's no table where an editor hand-picks
   "this week's highlights." Fine for now; worth adding a
   `digest_editions` table with admin curation once there's enough volume
   that "everything that changed" stops being a good digest on its own.

## Serving extracted text

`main.py` mounts `pdf-pipeline`'s local `storage/text/` directory as
static files at `/files/pdf-pipeline/text/...`, so "view extracted text"
in the admin UI is a plain link, not an authenticated download endpoint.
The mount path is built from `config.PDF_PIPELINE_DIR` — the same setting
`routers/processing.py` already uses to spawn that service — rather than
a second, independently-hardcoded path guess. Getting those two out of
sync is exactly the class of mistake that caused the original spawn
failure this whole feature was built alongside fixing, so there's
deliberately only one place that setting lives now.

Set `PUBLIC_API_BASE_URL` in `.env` once this isn't running on
`localhost:8000` — it's what `urls.py` uses to build the full URL
returned in `extractedTextUrl`.

This mount has no auth check (Starlette's `StaticFiles` doesn't support
adding one without replacing it entirely). Acceptable here because bill
text is government legislation, not sensitive data, and paths are keyed
by an unguessable content hash — but worth knowing if this API is ever
exposed outside a trusted admin network.

## Other things worth knowing

- **Search is `ILIKE`, not full-text.** Fine at current scale (hundreds of
  bills); if this grows, Postgres full-text search (`tsvector` + GIN
  index) or `pg_trgm` for fuzzy matching would be the next step — no
  frontend change needed either way, it's the same `q` param.
- **The stage stepper's order is a fixed approximation.** `STAGES` in
  `status_map.py` always shows `Introduced → Committee → Passed LS →
  Passed RS → Assented → Act`, but bills introduced in Rajya Sabha often
  pass RS before LS in reality. This keeps the existing frontend
  `BillStepper` component unchanged; a house-aware stage order would be
  more accurate but is a bigger change — flagging it, not fixing it here.
- **CORS** is locked to `CORS_ORIGINS` in `.env` — update it when you know
  your real frontend deployment URL.

## Files

| File | Responsibility |
|---|---|
| `main.py` | FastAPI app, CORS, router wiring, `/health` |
| `db.py` | Connection pool (`ThreadedConnectionPool`) |
| `auth.py` | bcrypt hashing, JWT issue/verify, `require_user`/`require_admin` dependencies |
| `status_map.py` | Raw sansad.in status → frontend badge taxonomy, stage computation |
| `serialize.py` | The one place a DB row becomes a frontend-shaped bill object |
| `models.py` | Pydantic request bodies |
| `schema.sql` | `users`, `comments`, `follows`, `mps`, `bill_sponsors` |
| `routers/bills.py` | `/bills`, `/bills/{id}`, `/topics` — public, approved-only |
| `routers/mps.py` | `/mps`, `/mps/{id}` — empty until MP ingestion exists |
| `routers/digest.py` | `/digest` — computed weekly grouping |
| `routers/auth_router.py` | `/auth/signup`, `/auth/login`, `/auth/me` |
| `routers/comments.py` | `/bills/{id}/comments`, delete-your-own |
| `routers/follows.py` | `/me/follows`, follow/unfollow |
| `routers/admin.py` | `/admin/queue`, approve/reject/edit, `/admin/entities` (paginated + sortable), `/admin/dashboard` |

`GET /admin/entities` accepts `page`, `page_size` (max 200), `sort_by`
(`bill_number` \| `bill_name` \| `status` \| `introduced_date` \| `last_seen_at`),
`sort_dir` (`asc` \| `desc`), `q` (free-text search across bill number and
name, `ILIKE`-based), `ai_status` (exact review status, or `'none'` for
bills with no AI content row yet — a synthetic value, not a real
`review_status`), and `processed_only` (bool — only bills with at least
one extracted document). All filters compose with AND, tested together
(e.g. `q=2025&ai_status=approved`) and confirmed the `sort_by` whitelist
safely no-ops on an injection attempt rather than erroring. `sort_by` is
matched against a whitelist dict before ever reaching the SQL string.
Response includes `total` for computing page count client-side, and the
`total` count respects whatever filters were applied — not the unfiltered
table size. `last_seen_at` is ingestion recency (when this bill's row was
last touched), distinct from `introduced_date` (the real-world legislative
date) — the admin UI sorts by the former by default.

### A real Windows bug, found and fixed

`routers/processing.py`'s subprocess spawn used `start_new_session=True`,
a **POSIX-only** `subprocess.Popen` argument — it raises `ValueError` on
Windows. Because the `processing_jobs` row is deliberately committed
*before* the spawn attempt (the child process needs to see it on its own
DB connection), a spawn failure left that row permanently stuck at
`'queued'` — invisible, and blocking every future attempt for that bill
via the partial unique index, since only `'failed'`/`'done'`/`'cancelled'`
rows are allowed to be superseded. Fixed two ways: `start_new_session`
is now conditional on `os.name == "posix"` (harmless to omit on Windows —
cancellation targets the exact PID directly, not a process group), and
**any** spawn failure now marks the job `'failed'` with the real error
message immediately, rather than leaving a silent stuck row — verified by
deliberately pointing `PDF_PIPELINE_DIR` at a nonexistent path and
confirming the job surfaced as `failed` with a clear message instead of
hanging forever, then confirming a subsequent retry (after fixing the
path) proceeded normally rather than being blocked by the old row.
| `routers/processing.py` | Admin-triggered, per-bill, cancellable processing jobs |

## Admin-controlled processing (replaces automatic ingestion fan-out)

**Architecture update:** job status is no longer self-reported by the
child process via a `--job-id` flag — it's tracked by the API (the
parent) watching the child's real exit code. This replaced the original
design after a real-world failure on Windows exposed its weakness: a
child that dies *before* reaching its own error-handling code (a bad CLI
argument, a missing dependency, any crash prior to its own try/except)
could never self-report, leaving its `processing_jobs` row silently stuck
at `queued` forever — invisible, and permanently blocking every future
attempt for that bill via the partial unique index. Watching the exit
code from the parent catches all of those uniformly, because it doesn't
require the child's cooperation. Concretely: `_spawn()` in
`routers/processing.py` marks the row `running` itself immediately after
a successful `Popen()`, then starts a daemon thread that blocks on
`proc.wait()` and records `done`/`failed` from the real return code once
the child exits. `pdf-pipeline` and `ai-pipeline` no longer write to
`processing_jobs` at all — that table is now exclusively owned by the API.

**Two real Windows-specific bugs, found and fixed:**

1. `subprocess.Popen(..., start_new_session=True)` is POSIX-only and
   raises `ValueError` on Windows — since the job row commits *before*
   the spawn attempt, this left it stuck at `queued` forever on Windows
   specifically. Fixed: conditional on `os.name == "posix"`.
2. The zombie-reaping background thread in `main.py` called
   `os.waitpid(-1, os.WNOHANG)` — `os.WNOHANG` doesn't exist on Windows at
   all, so the thread crashed (silently — Python threads don't propagate
   exceptions to the main process) on its very first iteration there.
   Fixed: the thread returns immediately on non-POSIX systems, since the
   new parent-side watcher's `Popen.wait()` already reaps its own child
   cross-platform — this thread was only ever needed for the POSIX zombie
   quirk in the first place.

**New: document action links.** `/admin/entities` now returns a
`documents` array per bill — `sourceUrl` (the original external PDF, e.g.
from sansad.in) and `extractedTextUrl` (the locally-extracted plain text,
served by a static file mount — see "Serving extracted text" below).
Batched in one extra query per page of results, not one query per bill.

Instead, an admin explicitly picks a bill and processes it:

```
POST   /admin/bills/{id}/process/pdf     -> spawns pdf-pipeline, scoped to this bill
POST   /admin/bills/{id}/process/ai      -> spawns ai-pipeline, scoped to this bill
POST   /admin/jobs/{job_id}/cancel       -> SIGTERMs the running subprocess
GET    /admin/bills/{id}/jobs            -> job history + live doc/AI status for one bill
GET    /admin/jobs?status=running        -> cross-bill overview
```

This was tested for real, not just written and assumed correct — including
finding and fixing two bugs that only showed up under actual process
control, not in code review:

1. **Zombie processes.** Every job is a real OS subprocess (spawned via
   `subprocess.Popen`, using `sys.executable` so it runs in the same
   shared venv as the API — see RUNBOOK.md for why direct Python imports
   between services would be unsafe instead). Cancelling one works —
   confirmed by capturing a job's real PID mid-download, sending cancel,
   and watching that exact PID disappear — but a killed child the parent
   never `wait()`s on becomes a zombie that lingers in the process table
   forever. `main.py` runs a small background thread that reaps them.
2. **Cancel left things stuck.** SIGTERM stops a subprocess mid-row —
   it never reaches the code that marks that row `done` or `failed`. Left
   alone, a cancelled PDF job's `bill_documents` row sits at `extracting`
   forever (not `pending`/`failed`, so the normal claim query skips it
   silently), and a cancelled AI job's `bill_ai_content` row sits at
   `generating` forever — which, worse, permanently blocks all future
   attempts to process that bill via the schema's own concurrency lock.
   `cancel_job` now explicitly resets both back to a retriable state.
   Verified end to end: triggered a job against a deliberately slow fake
   PDF host, confirmed it was genuinely mid-download (PID alive via `ps`),
   cancelled it, confirmed the process was actually dead, confirmed the
   document reset to `pending`, then re-triggered processing for the same
   bill and confirmed it completed successfully — not just re-queued.
