# AI bill summarization pipeline

Reads `bill_documents.extracted_text` (written by the PDF extraction
pipeline), sends it to whichever AI provider you configure, and writes a
structured summary into `bill_ai_content` with `review_status =
'pending_review'` — ready for your existing admin Review Queue.

This has been tested end-to-end in a sandbox against a real Postgres
database and Gemini's response shape. All of the following were confirmed
working for real:

- successful generation, parsed and written to `bill_ai_content`
- the concurrency lock (a second run doesn't re-claim an already-generating bill)
- Gemini's `responseSchema` format
- a malformed model response retrying twice, then failing cleanly with the
  reason recorded — never crashing the batch

## Supported providers

One interface (`providers/base.py`) and one implementation:

| Provider   | File                           | Structured output method                                                          |
| ---------- | ------------------------------ | --------------------------------------------------------------------------------- |
| **Gemini** | `providers/gemini_provider.py` | `responseSchema` (auto-converted to the restricted OpenAPI subset Gemini accepts) |

Gemini is selected by default. Set `GEMINI_API_KEY` in `.env`. The pipeline
tries `GEMINI_MODEL` first, then `GEMINI_MODEL_2`, then `GEMINI_MODEL_3` if a
model exhausts its configured retries. The successful model is stored in
`bill_ai_content.model_version`.

## Setup

```bash
pip install -r requirements.txt
cp .env.example .env
# fill in DATABASE_URL and whichever API key(s) you plan to use
psql "$DATABASE_URL" -f schema.sql       # extends bill_ai_content; safe to
                                          # run even if the base tables
                                          # already exist from the PDF pipeline
```

## Running

```bash
# summarize up to 20 bills with the default provider (AI_PROVIDER in .env)
python pipeline.py

# pick the Gemini model explicitly
python pipeline.py --provider gemini --model gemini-1.5-flash

# run forever, polling for newly-extracted bills every 10 minutes
python pipeline.py --loop --interval 600

# scoped to exactly one bill — this is what the API's admin-triggered
# "Generate summary" button calls
python pipeline.py --bill-id 42 --provider gemini
```

Same admin-controlled model as pdf-pipeline's `--bill-id` — see
`api/routers/processing.py` and `ingestion/README.md`. Also matches
pdf-pipeline in dropping self-reported job status: this script no longer
writes to `processing_jobs` at all (the `mark_job_running`/`mark_job_done`/
`mark_job_failed` functions that used to live in `db.py` are gone). The
API tracks job status itself by watching this process's exit code — more
robust, since it works even if this script crashes before any of its own
error handling runs. `bill_ai_content.review_status` (pending_review /
approved / failed) is a completely separate concern and is untouched by
this change — that's this script's actual output, not job bookkeeping.

## The summarization prompt

`summary_prompt.txt` provides the default prompt when no prompt is supplied.
`SYSTEM_PROMPT` sets the model up as a non-partisan legislative analyst
with explicit rules: only use the provided text, no outside knowledge, no
editorializing, be specific rather than vague, and flag uncertainty in
`confidence_notes` instead of guessing.

`BILL_SUMMARY_SCHEMA` is the contract Gemini is forced into:
`plain_title`, `summary`, `why_it_matters`, `topic` (constrained to your
frontend's existing topic taxonomy), `key_changes` (before/after pairs —
only populated when both an "as introduced" and a later-stage text are
available, which is exactly what feeds your `DiffTable` UI), and
`confidence_notes`.

`build_user_prompt()` handles the practical stuff: truncates overly long
bill text to `MAX_INPUT_CHARS`, and — when both an introduced and a
final/passed version exist — sends both so the model can actually compare
them instead of summarizing just one version.

`validate.py` then re-checks the parsed response against that same schema
with `jsonschema` before it's allowed near the database. Structured-output
modes make providers _usually_ comply, but "usually" isn't a good enough
guarantee for something headed into a public review queue.

## Concurrency and safety

- **Claiming = locking.** `db.reserve_generation()` inserts a `'generating'`
  row; a partial unique index (`schema.sql`) allows only one active
  (`generating`/`pending_review`) row per bill. Two workers racing for the
  same bill: one gets the row, the other gets a conflict and skips it —
  no duplicate API spend.
- **Never overwrites human review.** Once a moderator approves or rejects
  a row (in your existing admin queue), it's no longer "active", so
  re-running the pipeline generates a _new_ versioned row rather than
  clobbering their decision. Full history stays queryable by `bill_id`.
- **Retries are bounded and logged.** `MAX_RETRIES` / `RETRY_DELAY_SECONDS`
  control backoff; a bill that never succeeds ends up `review_status =
'failed'` with `error_message` set, not stuck forever or silently dropped.

## Files

| File                          | Responsibility                                                       |
| ----------------------------- | -------------------------------------------------------------------- |
| `config.py`                   | Env-var configuration — DB URL, provider keys/models, retry settings |
| `prompts.py`                  | The output schema + the system/user prompts                          |
| `validate.py`                 | Post-hoc schema validation before DB writes                          |
| `db.py`                       | Candidate selection, the locking insert, success/failure writes      |
| `providers/`                  | One file per provider behind a shared interface                      |
| `pipeline.py`                 | CLI orchestrator — the thing you actually run                        |
| `schema.sql`                  | Extends `bill_ai_content` with this service's bookkeeping columns    |
| `dev/fake_provider_server.py` | Local test double for all three API shapes                           |

## What's next

`bill_ai_content` rows land as `pending_review` — same admin queue UI you
already built handles them from here (approve/edit/reject). The one thing
still worth adding on the backend side: an endpoint your admin frontend
calls to flip `review_status` to `approved`/`rejected` and copy approved
content into the public `bills`-facing read model your frontend actually
queries. Want me to build that next?
