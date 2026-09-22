-- =============================================================================
-- NationPulse — migration 003
-- Data-driven schema corrections, derived from analysing all 6,963 real bills
-- in the Lok Sabha + Rajya Sabha API dumps (not assumptions).
--
-- Safe to run on the existing Supabase database. Every statement is guarded
-- (IF NOT EXISTS / IF EXISTS), so re-running it is harmless.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. THE BIG ONE: the API returns the SAME BILL TWICE at different lifecycle
--    stages.
--
--    Measured: 168 of 6,963 records collide on (bill_number, bill_year,
--    introduced_house). Verified all 168 are the same bill name at two
--    statuses — 167 are ('Passed','Assented'), 1 is ('Passed','Withdrawn').
--    ZERO are genuinely different bills. So the existing unique key is
--    CORRECT — those rows must collapse into one — but the upsert must never
--    let a later-arriving stale snapshot overwrite a more-advanced status.
--
--    status_rank gives us an orderable lifecycle position so the ingestion
--    upsert can say "only move forward, never backward".
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION status_rank(p_status text) RETURNS smallint
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE upper(btrim(coalesce(p_status, '')))
    WHEN 'ASSENTED'  THEN 60   -- became an Act: terminal, most advanced
    WHEN 'PASSED'    THEN 50   -- cleared both Houses
    WHEN 'PENDING'   THEN 40   -- still live in Parliament
    WHEN 'NEGATIVED' THEN 30   -- voted down: terminal
    WHEN 'WITHDRAWN' THEN 30   -- pulled by mover: terminal
    WHEN 'REMOVED'   THEN 30   -- removed from register: terminal
    WHEN 'LAPSED'    THEN 20   -- died with the House: terminal
    ELSE 0                     -- NULL/unknown (378 real records have NULL status)
  END::smallint;
$$;


-- -----------------------------------------------------------------------------
-- 2. Generated/derived columns on bills.
--    All are STORED so they can be indexed and sorted on directly.
-- -----------------------------------------------------------------------------

-- Cleaned category. Real data contains BOTH 'Constitutional Amendment Bill'
-- (235 rows) and 'Constitutional Amendment Bill ' with a trailing space
-- (20 rows) — without this they'd be two separate filter options in the UI.
ALTER TABLE public.bills
  ADD COLUMN IF NOT EXISTS bill_category_clean text
  GENERATED ALWAYS AS (nullif(btrim(bill_category), '')) STORED;

-- Cleaned ministry. 823 rows are NULL and 817 are empty-string — collapsing
-- them to a single NULL means "unattributed" is one bucket, not two.
ALTER TABLE public.bills
  ADD COLUMN IF NOT EXISTS ministry_clean text
  GENERATED ALWAYS AS (nullif(btrim(ministry_name), '')) STORED;

-- Cleaned act number: real values carry a trailing space ('17 ', '20 ').
ALTER TABLE public.bills
  ADD COLUMN IF NOT EXISTS act_no_clean text
  GENERATED ALWAYS AS (nullif(btrim(act_no), '')) STORED;

-- Orderable lifecycle position (see status_rank above).
ALTER TABLE public.bills
  ADD COLUMN IF NOT EXISTS status_rank smallint
  GENERATED ALWAYS AS (status_rank(status)) STORED;

-- The single best date to sort "recency" by, coalesced in lifecycle order.
-- Needed because no one date field is reliably populated: introduced 6916,
-- passed_ls 3838, passed_rs 3714, assented 3751 of 6963.
ALTER TABLE public.bills
  ADD COLUMN IF NOT EXISTS effective_date date
  GENERATED ALWAYS AS (
    coalesce(assented_date, passed_rs_date, passed_ls_date, introduced_date)
  ) STORED;


-- -----------------------------------------------------------------------------
-- 3. Document counters, maintained by trigger.
--
--    Why: the admin list currently recomputes counts with a LEFT JOIN +
--    GROUP BY across bill_documents on EVERY page load and every 4s poll.
--    At 6,963 bills / 8,081 documents that aggregate runs constantly. These
--    columns make the list query a plain indexed scan with no join at all.
-- -----------------------------------------------------------------------------
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS document_count      integer NOT NULL DEFAULT 0;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS documents_extracted integer NOT NULL DEFAULT 0;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS documents_failed    integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION refresh_bill_doc_counts() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE target_bill bigint;
BEGIN
  target_bill := coalesce(NEW.bill_id, OLD.bill_id);
  UPDATE public.bills b SET
    document_count      = (SELECT count(*) FROM public.bill_documents d WHERE d.bill_id = target_bill),
    documents_extracted = (SELECT count(*) FROM public.bill_documents d WHERE d.bill_id = target_bill AND d.extraction_status = 'done'),
    documents_failed    = (SELECT count(*) FROM public.bill_documents d WHERE d.bill_id = target_bill AND d.extraction_status = 'failed')
  WHERE b.id = target_bill;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_bill_doc_counts ON public.bill_documents;
CREATE TRIGGER trg_bill_doc_counts
AFTER INSERT OR UPDATE OF extraction_status OR DELETE ON public.bill_documents
FOR EACH ROW EXECUTE FUNCTION refresh_bill_doc_counts();

-- Backfill for rows that already exist.
UPDATE public.bills b SET
  document_count      = (SELECT count(*) FROM public.bill_documents d WHERE d.bill_id = b.id),
  documents_extracted = (SELECT count(*) FROM public.bill_documents d WHERE d.bill_id = b.id AND d.extraction_status = 'done'),
  documents_failed    = (SELECT count(*) FROM public.bill_documents d WHERE d.bill_id = b.id AND d.extraction_status = 'failed');


-- -----------------------------------------------------------------------------
-- 4. Latest-AI-status denormalisation, also trigger-maintained.
--    Replaces the correlated subquery the admin list runs per row.
-- -----------------------------------------------------------------------------
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS latest_ai_status text;

CREATE OR REPLACE FUNCTION refresh_bill_ai_status() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE target_bill bigint;
BEGIN
  target_bill := coalesce(NEW.bill_id, OLD.bill_id);
  UPDATE public.bills b SET latest_ai_status = (
    SELECT c.review_status FROM public.bill_ai_content c
    WHERE c.bill_id = target_bill ORDER BY c.generated_at DESC LIMIT 1
  ) WHERE b.id = target_bill;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_bill_ai_status ON public.bill_ai_content;
CREATE TRIGGER trg_bill_ai_status
AFTER INSERT OR UPDATE OF review_status OR DELETE ON public.bill_ai_content
FOR EACH ROW EXECUTE FUNCTION refresh_bill_ai_status();

UPDATE public.bills b SET latest_ai_status = (
  SELECT c.review_status FROM public.bill_ai_content c
  WHERE c.bill_id = b.id ORDER BY c.generated_at DESC LIMIT 1
);


-- -----------------------------------------------------------------------------
-- 5. bill_progress — the lifecycle timeline the frontend stepper renders.
--
--    The API gives each stage as a (date, file) pair on the bill row rather
--    than as events. This table turns those into real, queryable events so a
--    later snapshot of the same bill updates the timeline instead of
--    creating a duplicate — the ON CONFLICT key is (bill_id, stage).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bill_progress (
  id           bigserial PRIMARY KEY,
  bill_id      bigint NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  stage        text NOT NULL CHECK (stage IN (
                 'introduced','referred_to_committee','report_presented',
                 'passed_ls','passed_rs','assented','act')),
  stage_order  smallint NOT NULL,
  occurred_on  date,
  source_url   text,
  recorded_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bill_id, stage)
);

CREATE INDEX IF NOT EXISTS idx_bill_progress_bill ON public.bill_progress(bill_id, stage_order);

-- Backfills the timeline from whatever the bills table already holds. The
-- ingestion service should call this same logic per bill on every run; it's
-- written as an idempotent upsert so re-running only fills gaps / updates
-- dates, never duplicates.
INSERT INTO public.bill_progress (bill_id, stage, stage_order, occurred_on, source_url)
SELECT id, 'introduced', 1, introduced_date, NULL FROM public.bills WHERE introduced_date IS NOT NULL
UNION ALL SELECT id, 'referred_to_committee', 2, referred_to_committee_date, NULL FROM public.bills WHERE referred_to_committee_date IS NOT NULL
UNION ALL SELECT id, 'report_presented', 3, report_presented_date, NULL FROM public.bills WHERE report_presented_date IS NOT NULL
UNION ALL SELECT id, 'passed_ls', 4, passed_ls_date, NULL FROM public.bills WHERE passed_ls_date IS NOT NULL
UNION ALL SELECT id, 'passed_rs', 5, passed_rs_date, NULL FROM public.bills WHERE passed_rs_date IS NOT NULL
UNION ALL SELECT id, 'assented', 6, assented_date, NULL FROM public.bills WHERE assented_date IS NOT NULL
UNION ALL SELECT id, 'act', 7, assented_date, NULL FROM public.bills WHERE btrim(coalesce(act_no,'')) <> ''
ON CONFLICT (bill_id, stage) DO UPDATE
  SET occurred_on = EXCLUDED.occurred_on,
      source_url  = coalesce(EXCLUDED.source_url, public.bill_progress.source_url);


-- -----------------------------------------------------------------------------
-- 6. OCR / extraction-quality tracking on documents.
--    `extraction_method` already exists ('pdfplumber'|'pymupdf'|'ocr'), so
--    the UI's "OCR" tag just reads that. These add the surrounding context.
-- -----------------------------------------------------------------------------
ALTER TABLE public.bill_documents ADD COLUMN IF NOT EXISTS used_ocr boolean NOT NULL DEFAULT false;
ALTER TABLE public.bill_documents ADD COLUMN IF NOT EXISTS extracted_char_count integer;
ALTER TABLE public.bill_documents ADD COLUMN IF NOT EXISTS last_attempted_at timestamptz;

UPDATE public.bill_documents SET used_ocr = true WHERE extraction_method = 'ocr' AND used_ocr = false;

-- Lets the AI stage summarise a bill from the documents that DID extract,
-- instead of being blocked because a sibling PDF has a dead link.
ALTER TABLE public.bill_ai_content ADD COLUMN IF NOT EXISTS source_doc_ids bigint[];


-- -----------------------------------------------------------------------------
-- 7. Comment replies + soft delete.
--    parent_id enables threading; soft delete keeps replies to a deleted
--    comment from being orphaned by a CASCADE.
-- -----------------------------------------------------------------------------
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS parent_id  bigint REFERENCES public.comments(id) ON DELETE CASCADE;
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS edited_at  timestamptz;

CREATE INDEX IF NOT EXISTS idx_comments_parent ON public.comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_comments_bill_live ON public.comments(bill_id, created_at) WHERE deleted_at IS NULL;


-- -----------------------------------------------------------------------------
-- 8. Indexes for the admin list at 6,963-row scale.
--    Every one of these backs a filter/sort the admin UI actually issues.
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_bills_status           ON public.bills(status);
CREATE INDEX IF NOT EXISTS idx_bills_status_rank      ON public.bills(status_rank DESC);
CREATE INDEX IF NOT EXISTS idx_bills_effective_date   ON public.bills(effective_date DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_bills_category_clean   ON public.bills(bill_category_clean);
CREATE INDEX IF NOT EXISTS idx_bills_ministry_clean   ON public.bills(ministry_clean);
CREATE INDEX IF NOT EXISTS idx_bills_type             ON public.bills(bill_type);
CREATE INDEX IF NOT EXISTS idx_bills_house            ON public.bills(introduced_house);
CREATE INDEX IF NOT EXISTS idx_bills_year             ON public.bills(bill_year DESC);
CREATE INDEX IF NOT EXISTS idx_bills_latest_ai_status ON public.bills(latest_ai_status);
CREATE INDEX IF NOT EXISTS idx_bills_doc_count        ON public.bills(document_count);
CREATE INDEX IF NOT EXISTS idx_bills_last_seen        ON public.bills(last_seen_at DESC);

-- Trigram index for the admin search box. Plain ILIKE '%term%' cannot use a
-- btree index — at 6,963 rows every keystroke would be a full table scan.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_bills_name_trgm   ON public.bills USING gin (bill_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_bills_number_trgm ON public.bills USING gin (bill_number gin_trgm_ops);


-- -----------------------------------------------------------------------------
-- 9. source_raw: measured 100% redundant, but don't just drop it.
--
--    Every one of the 25 fields the API returns already maps to a real
--    column, and the blob averages 951 bytes (~6.3 MB across 6,963 bills).
--    So it stores nothing you can't reconstruct — BUT dropping it outright
--    removes your only way to notice if sansad.in adds a 26th field later.
--
--    Compromise: keep the column for now (it is the safety net during this
--    migration) and add a cheap drift detector the ingestion service fills
--    with ONLY unrecognised keys — normally empty, so ~0 bytes.
--    Once you've run a few ingests and confirmed source_unknown stays empty,
--    run the commented-out DROP at the bottom to reclaim the 6.3 MB.
-- -----------------------------------------------------------------------------
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS source_unknown jsonb;

-- Run this only AFTER you've confirmed source_unknown stays empty:
--   ALTER TABLE public.bills DROP COLUMN source_raw;
--   (content_hash is computed from the API payload in Python, so change
--    detection keeps working without the stored blob.)


-- -----------------------------------------------------------------------------
-- 10. Unused tables. MPs are out of scope for now — these stay empty and
--     cost nothing, so they're left in place rather than dropped, to keep
--     /mps endpoints from erroring. Uncomment to remove entirely.
-- -----------------------------------------------------------------------------
--   DROP TABLE IF EXISTS public.bill_sponsors;
--   DROP TABLE IF EXISTS public.mps;


-- -----------------------------------------------------------------------------
-- 11. Convenience view for the admin list — keeps the API query simple and
--     guarantees the frontend, API and any ad-hoc SQL all agree on what
--     "processable" means.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.admin_bill_list AS
SELECT
  b.id, b.bill_number, b.bill_name, b.bill_type,
  b.bill_category_clean AS bill_category,
  b.ministry_clean      AS ministry_name,
  b.bill_year, b.introduced_house, b.introduced_by,
  b.status, b.status_rank, b.effective_date,
  b.introduced_date, b.passed_ls_date, b.passed_rs_date, b.assented_date,
  b.act_no_clean AS act_no, b.act_year,
  b.document_count, b.documents_extracted, b.documents_failed,
  b.latest_ai_status, b.last_seen_at, b.last_changed_at,
  (b.document_count > 0)                                        AS is_processable,
  (b.document_count > 0 AND b.documents_extracted = b.document_count) AS is_fully_extracted,
  (b.documents_extracted > 0)                                   AS has_any_text
FROM public.bills b;
