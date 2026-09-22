# Running NationPulse locally with Supabase — one venv, one requirements.txt

## 1. Lay out the folders

```bash
mkdir nationpulse && cd nationpulse
mkdir -p apps services

unzip nation-pulse.zip -d apps/web
mkdir -p services/ingestion && unzip ingestion.zip -d services/ingestion
mkdir -p services/pdf-pipeline && unzip pdf-pipeline.zip -d services/pdf-pipeline
mkdir -p services/ai-pipeline && unzip ai-pipeline.zip -d services/ai-pipeline
unzip api.zip -d api
unzip db.zip -d db
# copy configure_env.py and Makefile (from this delivery) into nationpulse/scripts/ and nationpulse/ respectively
```

```
nationpulse/
├── Makefile                          <- new
├── apps/web/
├── services/{ingestion,pdf-pipeline,ai-pipeline}/
├── api/
│   └── requirements.txt              <- now the COMBINED manifest for all 4 services
├── db/migrations/001_initial_schema.sql
└── scripts/configure_env.py
```

---

## 2. Supabase setup, step by step

**Create the project**
1. [supabase.com](https://supabase.com) → sign in → **New project**.
2. Pick an organization, name it (`nationpulse-dev` — use a *second*,
   separate project later for prod, don't share one between dev and prod).
3. Set a database password. Generate a strong one and save it somewhere —
   you'll paste it into a connection string in a minute, and Supabase
   won't show it to you again after this screen.
4. Pick a region close to you (Mumbai/`ap-south-1` if you're in India) —
   this becomes part of your connection string's hostname, so note it.
5. Create the project. It takes 1–2 minutes to provision.

**Get the connection string**
1. Once the project's ready, click the **Connect** button (top of the
   project dashboard — it's the fastest path to this, faster than digging
   through Settings).
2. You'll see three connection modes. Use **Session pooler**, port
   `5432` — not Transaction pooler (port `6543`). Reason: the API service
   holds a small persistent connection pool (`ThreadedConnectionPool` in
   `api/db.py`), and Supabase's transaction-mode pooling is built for
   short-lived serverless-style connections — it doesn't support
   session-level features some drivers rely on. Session mode and the
   direct connection both behave like a normal Postgres connection, which
   is what a persistent pool expects.
3. Copy the URI. It looks like:
   ```
   postgresql://postgres.xxxxxxxxxxxx:[YOUR-PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:5432/postgres
   ```
4. Replace `[YOUR-PASSWORD]` with the real password from step 3 above.

**Two things you can ignore**, because we're only using Supabase as
hosted Postgres, not its Auth/Storage/REST layer:
- The **anon key** and **service_role key** shown elsewhere in the
  dashboard — those authenticate Supabase's own REST/GraphQL API
  (PostgREST), which nothing here uses. The only credential that matters
  for this project is the database password in the connection string.
- **Row Level Security (RLS)** — RLS policies are enforced for
  PostgREST/anon-key access. Every service here connects with the raw
  `postgres` role over the normal Postgres wire protocol via
  `DATABASE_URL`, which bypasses RLS entirely. No RLS setup needed; if
  Supabase's dashboard nags you about tables without RLS enabled, that
  warning doesn't apply to how this project accesses the database.

**Apply the schema**
Dashboard → **SQL Editor** → New query → paste the entire contents of
`db/migrations/001_initial_schema.sql` → Run. Confirm all 9 tables show
up in **Table Editor** afterward.

**One gotcha to know about**: free-tier Supabase projects auto-pause
after a week of no activity. If a local run suddenly can't connect after
you've been away, check the dashboard — there's usually a one-click
"Restore project" button waiting for you.

---

## 3. One shared venv, from `api/requirements.txt`

```bash
cd nationpulse
make install
```

That's `python3 -m venv .venv` + `pip install -r api/requirements.txt`,
which now contains every dependency all four services need — verified by
actually importing all four services' real modules from the resulting
venv and confirming zero conflicts (every package the services share —
`httpx`, `psycopg2-binary`, `python-dotenv` — was already pinned to the
identical version in each service, so merging was a clean union, not a
resolution problem).

The venv lives at the **repo root** (`nationpulse/.venv`), not inside
`api/` — that's deliberate. `make ingest`, `make api`, etc. all resolve to
this one interpreter regardless of which service's folder the command
actually executes in, which wouldn't be true if the venv were nested
inside just one service.

**Worth knowing, so you don't "simplify" this further into a footgun:**
`ingestion/trigger.py` calls the PDF and AI pipelines via `subprocess`,
not a direct Python `import`. Now that everything shares one venv, direct
imports would technically work dependency-wise — but every service has
its own `config.py`, `db.py`, and (for three of them) `pipeline.py`.
Python caches modules by filename in `sys.modules`; importing `config`
from two different services in the same process silently returns the
**first** one imported for every later `import config`, not the one you
meant. I actually reproduced this to confirm before writing this note —
it's a real, silent bug, not a hypothetical. Subprocess isolation (a
fresh interpreter per pipeline run) is what avoids it, and it's worth
keeping even with the shared venv.

---

## 4. Point every service at Supabase

```bash
make configure DB_URL="postgresql://postgres.xxxx:PASSWORD@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"
```

Then manually add (not shared secrets the same way a DB URL is, so the
script won't touch these):
- `services/ai-pipeline/.env` → at least one of `ANTHROPIC_API_KEY` /
  `OPENAI_API_KEY` / `GEMINI_API_KEY` / `OPENROUTER_API_KEY`
- `api/.env` → `JWT_SECRET` (any long random string for local dev)

`pdf-pipeline`'s OCR fallback needs system packages too, only if you want
OCR for scanned PDFs (`brew install tesseract poppler` on macOS,
`apt-get install tesseract-ocr poppler-utils` on Ubuntu/Debian) — separate
from the Python venv either way.

---

## 5. Run it

```bash
make ingest        # or: make ingest-rs / make ingest-ls for one house at a time
```
Watch Supabase's Table Editor: `bills` fills in, `bill_documents.extraction_status`
moves to `done`, `bill_ai_content` rows appear as `pending_review`.

```bash
make api
```
Open **http://localhost:8000/docs** — the fastest way to see real data:
sign up, promote yourself to admin directly in Supabase's Table Editor
(`UPDATE users SET is_admin = true WHERE email = '...'`), log in, approve
something in `/admin/queue`, then `GET /bills` and watch it appear.

```bash
make web
```
Still reads `src/data/mockData.js`, not this API yet — that rewiring is
the next piece of work. `/docs` is where the real data lives until then.

For repeat ingestion runs, there's no `--loop` flag (unlike the other two
services) — either run `make ingest` on a schedule yourself (cron), or
say the word and I'll add `--loop` to match the other two.
