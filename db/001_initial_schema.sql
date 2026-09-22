-- =============================================================================
-- NationPulse — master schema
-- =============================================================================
-- One consolidated file, deduplicated from the four services' individual
-- schema.sql files (ingestion, pdf-pipeline, ai-pipeline, api), which were
-- verified identical on the shared tables before merging. Run this ONCE
-- against a fresh database instead of running all four services' schema.sql
-- files separately — they're kept in each service only so that service is
-- runnable completely standalone (e.g. for local dev of just one piece).
--
-- Ownership, so you know which service's code to check when a table's
-- shape needs to change:
--   bills, bill_documents        -> owned by ingestion (written by ingestion,
--                                    read/updated by pdf-pipeline)
--   ingestion_state              -> owned by ingestion
--   bill_ai_content              -> owned by ai-pipeline
--   users, comments, follows,
--   mps, bill_sponsors           -> owned by api
-- =============================================================================


-- -----------------------------------------------------------------------------
-- bills — one row per bill, sourced from sansad.in via the ingestion service
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bills (
  id                          BIGSERIAL PRIMARY KEY,
  bill_number                 TEXT NOT NULL,
  bill_name                   TEXT NOT NULL,
  bill_type                   TEXT,               -- 'Government' | 'Private'
  bill_category                TEXT,               -- 'Ordinary Bill' | 'Money Bill' | ...
  ministry_name                TEXT,
  bill_year                    SMALLINT,
  introduced_house             TEXT,               -- 'Lok Sabha' | 'Rajya Sabha'
  introduced_by                TEXT,
  introduced_date              DATE,
  passed_ls_date                DATE,
  passed_rs_date                DATE,
  referred_to_committee_date    DATE,
  report_presented_date         DATE,
  act_no                       TEXT,
  act_year                     SMALLINT,
  assented_date                 DATE,
  status                       TEXT NOT NULL,      -- raw string from sansad.in
  normalized_status             TEXT,               -- reserved; API currently maps at read time (status_map.py)
  source_raw                   JSONB NOT NULL,      -- full original API record, for fidelity/future-proofing
  content_hash                 TEXT NOT NULL,       -- sha256 of source_raw — cheap change detection
  first_seen_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_changed_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (bill_number, bill_year, introduced_house)
);

CREATE INDEX IF NOT EXISTS idx_bills_status ON bills(status);
CREATE INDEX IF NOT EXISTS idx_bills_ministry ON bills(ministry_name);
CREATE INDEX IF NOT EXISTS idx_bills_year ON bills(bill_year);


-- -----------------------------------------------------------------------------
-- bill_documents — every PDF attached to a bill (as introduced, as passed,
-- gazette copy, errata, etc.), plus the extracted plain text once the
-- pdf-pipeline service has processed it
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE bill_doc_type AS ENUM (
    'introduced', 'passed_ls', 'passed_rs', 'passed_both_houses',
    'errata', 'report', 'gazetted', 'synopsis'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS bill_documents (
  id                 BIGSERIAL PRIMARY KEY,
  bill_id            BIGINT NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  doc_type           bill_doc_type NOT NULL,
  source_url         TEXT NOT NULL,
  original_filename  TEXT,
  storage_path       TEXT,               -- local path or s3:// URI of the downloaded raw PDF
  file_hash          TEXT,               -- sha256 of the downloaded bytes — dedupe + change detection
  file_size_bytes     BIGINT,
  downloaded_at       TIMESTAMPTZ,
  extracted_text      TEXT,
  extraction_method   TEXT,               -- 'pdfplumber' | 'pymupdf' | 'ocr'
  extraction_status   TEXT NOT NULL DEFAULT 'pending',
                       -- pending | downloading | extracting | done | failed | no_text_layer
  extracted_at         TIMESTAMPTZ,
  page_count           INT,
  download_attempts    INT NOT NULL DEFAULT 0,
  error_message         TEXT,
  UNIQUE (bill_id, doc_type)
);

CREATE INDEX IF NOT EXISTS idx_bill_documents_status ON bill_documents(extraction_status);


-- -----------------------------------------------------------------------------
-- ingestion_state — one row per house, tracking the last observed bill
-- count so each ingestion run can tell "did anything change" cheaply
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ingestion_state (
  house                 TEXT PRIMARY KEY,
  last_total_bills       INT NOT NULL DEFAULT 0,
  last_new_bills_count    INT NOT NULL DEFAULT 0,
  last_run_at             TIMESTAMPTZ,
  last_run_status         TEXT,     -- 'ok' | 'warning' | 'error'
  last_run_note           TEXT
);


-- -----------------------------------------------------------------------------
-- bill_ai_content — the AI-generated interpretive layer: summary, plain-
-- language "why it matters", and before/after key changes. Versioned and
-- append-only — a bill can accumulate multiple rows over time (re-runs,
-- model upgrades); the API always reads the latest 'approved' one.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bill_ai_content (
  id                BIGSERIAL PRIMARY KEY,
  bill_id           BIGINT NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  source_doc_id     BIGINT REFERENCES bill_documents(id),
  provider          TEXT,               -- 'claude' | 'openai' | 'gemini' | 'openrouter'
  model_version     TEXT NOT NULL,
  prompt_version    TEXT,
  plain_title       TEXT,
  summary           TEXT,
  why_it_matters    TEXT,
  topic             TEXT,
  key_changes       JSONB,              -- [{before, after}, ...] — feeds the frontend's DiffTable
  confidence_notes  TEXT,
  input_char_count  INT,
  latency_ms        INT,
  raw_response      JSONB,              -- full raw provider response, for audit/debugging
  review_status     TEXT NOT NULL DEFAULT 'generating',
                     -- generating | pending_review | approved | rejected | failed
  error_message     TEXT,
  generated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by       TEXT,
  reviewed_at       TIMESTAMPTZ
);

-- Only one active ('generating' or awaiting review) row per bill at a time.
-- This IS the concurrency lock the ai-pipeline uses: claiming a bill means
-- successfully inserting a 'generating' row; a conflict means another
-- worker already claimed it.
CREATE UNIQUE INDEX IF NOT EXISTS idx_bill_ai_content_active
  ON bill_ai_content(bill_id)
  WHERE review_status IN ('generating', 'pending_review');

CREATE INDEX IF NOT EXISTS idx_bill_ai_content_review_status ON bill_ai_content(review_status);
CREATE INDEX IF NOT EXISTS idx_bill_ai_content_bill ON bill_ai_content(bill_id);


-- -----------------------------------------------------------------------------
-- users — real accounts, only needed for commenting/following/admin
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id             BIGSERIAL PRIMARY KEY,
  name           TEXT NOT NULL,
  email          TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,          -- bcrypt
  is_admin       BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- -----------------------------------------------------------------------------
-- comments — one per bill per user post
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS comments (
  id          BIGSERIAL PRIMARY KEY,
  bill_id     BIGINT NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comments_bill ON comments(bill_id);


-- -----------------------------------------------------------------------------
-- follows — a user following a bill, a topic, or an MP (kind + target_id
-- covers all three with one table instead of three near-identical ones)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS follows (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('bill', 'topic', 'mp')),
  target_id   TEXT NOT NULL,             -- bill id, topic name, or mp id — always text
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind, target_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_user ON follows(user_id);


-- -----------------------------------------------------------------------------
-- mps — placeholder until an MP-ingestion service exists (none built yet).
-- Table exists now so /mps, MP profiles, and follow-an-MP are fully wired
-- end to end; it will just return an empty list until something populates it.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mps (
  id                BIGSERIAL PRIMARY KEY,
  name              TEXT NOT NULL,
  house             TEXT,
  state             TEXT,
  constituency      TEXT,
  party             TEXT,
  bloc              TEXT,
  term              TEXT,
  terms             INT,
  education         TEXT,
  committee         TEXT,
  topics            TEXT[] DEFAULT '{}',
  bio               TEXT,
  bills_sponsored   INT DEFAULT 0,
  questions_asked   INT DEFAULT 0,
  attendance_pct    INT,
  debates_count     INT,
  source_raw        JSONB,
  UNIQUE (name, constituency)
);


-- -----------------------------------------------------------------------------
-- bill_sponsors — many-to-many, populated once MP data + sponsor info exist
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bill_sponsors (
  bill_id  BIGINT NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  mp_id    BIGINT NOT NULL REFERENCES mps(id) ON DELETE CASCADE,
  PRIMARY KEY (bill_id, mp_id)
);
