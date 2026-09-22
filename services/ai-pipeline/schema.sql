-- Extends the bill_ai_content table (from the ingestion step) with the
-- columns this service needs: which provider/model produced a row, how
-- long it took, the raw API response for auditing, and a locking column.
--
-- Safe to run against a DB that already has the base bill_ai_content table
-- from earlier — every ALTER is IF NOT EXISTS / guarded.

CREATE TABLE IF NOT EXISTS bill_ai_content (
  id                BIGSERIAL PRIMARY KEY,
  bill_id           BIGINT NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  source_doc_id     BIGINT REFERENCES bill_documents(id),
  provider          TEXT,
  model_version     TEXT NOT NULL,
  prompt_version    TEXT,
  plain_title       TEXT,
  summary           TEXT,
  why_it_matters    TEXT,
  topic             TEXT,
  key_changes       JSONB,
  confidence_notes  TEXT,
  input_char_count  INT,
  latency_ms        INT,
  raw_response      JSONB,
  review_status     TEXT NOT NULL DEFAULT 'generating',
                     -- generating | pending_review | approved | rejected | failed
  error_message     TEXT,
  generated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by       TEXT,
  reviewed_at       TIMESTAMPTZ
);

-- Only one active ('generating' or awaiting review) row per bill at a time.
-- This is also the concurrency lock: claiming a bill = successfully
-- inserting a 'generating' row; a conflict means another worker got there first.
CREATE UNIQUE INDEX IF NOT EXISTS idx_bill_ai_content_active
  ON bill_ai_content(bill_id)
  WHERE review_status IN ('generating', 'pending_review');

CREATE INDEX IF NOT EXISTS idx_bill_ai_content_review_status ON bill_ai_content(review_status);
CREATE INDEX IF NOT EXISTS idx_bill_ai_content_bill ON bill_ai_content(bill_id);
