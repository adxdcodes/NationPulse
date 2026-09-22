-- bills / bill_documents are shared with the pdf-pipeline and ai-pipeline
-- services (all three point at the same database) — repeated here so this
-- service is runnable standalone. CREATE IF NOT EXISTS makes re-applying
-- across services harmless.

CREATE TABLE IF NOT EXISTS bills (
  id                          BIGSERIAL PRIMARY KEY,
  bill_number                 TEXT NOT NULL,
  bill_name                   TEXT NOT NULL,
  bill_type                   TEXT,
  bill_category               TEXT,
  ministry_name                TEXT,
  bill_year                   SMALLINT,
  introduced_house             TEXT,
  introduced_by                TEXT,
  introduced_date              DATE,
  passed_ls_date                DATE,
  passed_rs_date                DATE,
  referred_to_committee_date    DATE,
  report_presented_date         DATE,
  act_no                       TEXT,
  act_year                     SMALLINT,
  assented_date                 DATE,
  status                       TEXT NOT NULL,
  normalized_status             TEXT,
  source_raw                   JSONB NOT NULL,
  content_hash                 TEXT NOT NULL,
  first_seen_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_changed_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (bill_number, bill_year, introduced_house)
);

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
  storage_path       TEXT,
  file_hash          TEXT,
  file_size_bytes     BIGINT,
  downloaded_at       TIMESTAMPTZ,
  extracted_text      TEXT,
  extraction_method   TEXT,
  extraction_status   TEXT NOT NULL DEFAULT 'pending',
  extracted_at         TIMESTAMPTZ,
  page_count           INT,
  download_attempts    INT NOT NULL DEFAULT 0,
  error_message         TEXT,
  UNIQUE (bill_id, doc_type)
);

CREATE INDEX IF NOT EXISTS idx_bill_documents_status ON bill_documents(extraction_status);
CREATE INDEX IF NOT EXISTS idx_bills_status ON bills(status);

-- New: this service's own bookkeeping. One row per house, tracking the last
-- observed total bill count so the next run can tell "did anything change"
-- with zero extra API calls or DB scans.
CREATE TABLE IF NOT EXISTS ingestion_state (
  house                 TEXT PRIMARY KEY,
  last_total_bills       INT NOT NULL DEFAULT 0,
  last_new_bills_count    INT NOT NULL DEFAULT 0,
  last_run_at             TIMESTAMPTZ,
  last_run_status         TEXT,     -- 'ok' | 'warning' | 'error'
  last_run_note           TEXT
);
