-- NationPulse V2 | PostgreSQL 14+ | FRESH EMPTY DATABASE ONLY
-- Run with pSQL -v ON_ERROR_STOP=1 -f nationpulse_v2_schema.sql
-- No DROP statements; not an in-place migration for an existing installation.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE public.users (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 name text NOT NULL, email text NOT NULL UNIQUE, password_hash text NOT NULL,
 is_admin boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.bills (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 bill_number text NOT NULL, bill_name text NOT NULL,
 bill_type text, bill_category text, ministry_name text,
 bill_year smallint, introduced_house text, introduced_by text,
 introduced_date date, passed_ls_date date, passed_rs_date date,
 referred_to_committee_date date, report_presented_date date,
 act_no text, act_year smallint, assented_date date,
 status text NOT NULL DEFAULT 'Unknown', normalized_status text,
 source_raw jsonb NOT NULL DEFAULT '{}'::jsonb,
 content_hash text NOT NULL DEFAULT '',
 first_seen_at timestamptz NOT NULL DEFAULT now(),
 last_seen_at timestamptz NOT NULL DEFAULT now(),
 last_changed_at timestamptz NOT NULL DEFAULT now(),
 latest_movement_at timestamptz,
 identity_review_required boolean NOT NULL DEFAULT false,
 CONSTRAINT bills_year_check CHECK (bill_year IS NULL OR bill_year BETWEEN 1800 AND 2200),
 CONSTRAINT bills_house_check CHECK (introduced_house IS NULL OR introduced_house IN ('Lok Sabha','Rajya Sabha'))
);
COMMENT ON COLUMN public.bills.latest_movement_at IS 'Latest verified legislative event time, not the most recent ingestion time.';
COMMENT ON COLUMN public.bills.identity_review_required IS 'Flag ambiguous cross-source matches for human review.';

-- Stable identity is scoped to the introducing house, year and bill number.
-- A bill seen in the other house must be linked to this canonical bill, not re-created.
CREATE UNIQUE INDEX bills_canonical_identity_uq ON public.bills (introduced_house, bill_year, lower(btrim(bill_number)))
 WHERE introduced_house IS NOT NULL AND bill_year IS NOT NULL AND btrim(bill_number) <> '';
CREATE INDEX bills_latest_movement_idx ON public.bills (latest_movement_at DESC NULLS LAST, id DESC);
CREATE INDEX bills_introduced_date_idx ON public.bills (introduced_date DESC NULLS LAST, id DESC);
CREATE INDEX bills_changed_idx ON public.bills (last_changed_at DESC, id DESC);
CREATE INDEX bills_ministry_year_idx ON public.bills (ministry_name, bill_year);
CREATE INDEX bills_category_status_idx ON public.bills (bill_category, normalized_status);
CREATE INDEX bills_name_trgm_idx ON public.bills USING gin (bill_name gin_trgm_ops);

CREATE TABLE public.ingestion_state (
 house text PRIMARY KEY CHECK (house IN ('Lok Sabha','Rajya Sabha')),
 last_total_bills integer NOT NULL DEFAULT 0 CHECK (last_total_bills >= 0),
 last_new_bills_count integer NOT NULL DEFAULT 0 CHECK (last_new_bills_count >= 0),
 last_run_at timestamptz, last_run_status text, last_run_note text
);

CREATE TABLE public.ingestion_runs (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 house text NOT NULL CHECK (house IN ('Lok Sabha','Rajya Sabha')),
 started_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz,
 status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','completed','failed','cancelled')),
 source_total integer CHECK (source_total IS NULL OR source_total >= 0),
 inserted_count integer NOT NULL DEFAULT 0 CHECK (inserted_count >= 0),
 updated_count integer NOT NULL DEFAULT 0 CHECK (updated_count >= 0),
 duplicate_count integer NOT NULL DEFAULT 0 CHECK (duplicate_count >= 0),
 error_message text
);

-- Immutable snapshots: identical upstream records can be deduplicated per run.
CREATE TABLE public.bill_source_observations (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 bill_id bigint REFERENCES public.bills(id) ON DELETE SET NULL,
 ingestion_run_id bigint REFERENCES public.ingestion_runs(id) ON DELETE SET NULL,
 source_house text NOT NULL CHECK (source_house IN ('Lok Sabha','Rajya Sabha')),
 source_bill_number text, source_bill_year smallint,
 source_status text, source_url text,
 raw_record jsonb NOT NULL,
 record_hash text NOT NULL,
 observed_at timestamptz NOT NULL DEFAULT now(),
 identity_confidence text NOT NULL DEFAULT 'unverified'
  CHECK (identity_confidence IN ('verified','probable','unverified','conflict')),
 UNIQUE (ingestion_run_id, source_house, record_hash)
);
CREATE INDEX source_obs_bill_time_idx ON public.bill_source_observations (bill_id, observed_at DESC);
CREATE INDEX source_obs_house_number_idx ON public.bill_source_observations (source_house, source_bill_year, source_bill_number);
CREATE INDEX source_obs_raw_gin_idx ON public.bill_source_observations USING gin (raw_record jsonb_path_ops);

CREATE TABLE public.bill_movements (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 bill_id bigint NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
 event_type text NOT NULL CHECK (event_type IN
  ('introduced','passed_ls','passed_rs','passed_both','referred_to_committee',
   'committee_report_presented','assented','gazetted','withdrawn','lapsed','other')),
 event_date date NOT NULL, event_time timestamptz,
 event_house text CHECK (event_house IS NULL OR event_house IN ('Lok Sabha','Rajya Sabha')),
 description text, source_observation_id bigint REFERENCES public.bill_source_observations(id) ON DELETE SET NULL,
 source_document_id bigint, -- FK added after bill_documents is created
 verification_status text NOT NULL DEFAULT 'source_reported'
  CHECK (verification_status IN ('source_reported','verified','disputed')),
 recorded_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (bill_id,event_type,event_date,event_house)
);
CREATE INDEX bill_movements_recent_idx ON public.bill_movements (event_date DESC, id DESC);
CREATE INDEX bill_movements_bill_idx ON public.bill_movements (bill_id,event_date DESC);
CREATE INDEX bill_movements_type_date_idx ON public.bill_movements (event_type,event_date DESC);

CREATE TABLE public.bill_documents (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 bill_id bigint NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
 doc_type text NOT NULL, source_url text NOT NULL,
 original_filename text, storage_path text, file_hash text,
 file_size_bytes bigint CHECK (file_size_bytes IS NULL OR file_size_bytes >= 0),
 downloaded_at timestamptz, extracted_text text, extraction_method text,
 extraction_status text NOT NULL DEFAULT 'pending'
  CHECK (extraction_status IN ('pending','downloading','extracting','done','no_text_layer','failed','skipped')),
 extracted_at timestamptz, page_count integer CHECK (page_count IS NULL OR page_count >= 0),
 download_attempts integer NOT NULL DEFAULT 0 CHECK (download_attempts >= 0),
 error_message text,
 -- Link health is independent of extraction. Do not delete cached files when a link breaks.
 link_status text NOT NULL DEFAULT 'unchecked'
  CHECK (link_status IN ('unchecked','available','broken','timeout','blocked','rate_limited','server_error','invalid_content','unknown')),
 http_status_code smallint CHECK (http_status_code IS NULL OR http_status_code BETWEEN 100 AND 599),
 last_checked_at timestamptz, last_success_at timestamptz,
 response_content_type text, final_url text, link_error text,
 check_attempts integer NOT NULL DEFAULT 0 CHECK (check_attempts >= 0),
 last_check_latency_ms integer CHECK (last_check_latency_ms IS NULL OR last_check_latency_ms >= 0),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (bill_id, doc_type, source_url)
);
ALTER TABLE public.bill_movements ADD CONSTRAINT bill_movements_document_fkey
 FOREIGN KEY (source_document_id) REFERENCES public.bill_documents(id) ON DELETE SET NULL;
CREATE INDEX bill_documents_bill_status_idx ON public.bill_documents (bill_id,extraction_status);
CREATE INDEX bill_documents_extract_queue_idx ON public.bill_documents (id) WHERE extraction_status IN ('pending','failed');
CREATE INDEX bill_documents_link_queue_idx ON public.bill_documents (last_checked_at NULLS FIRST, id)
 WHERE link_status IN ('unchecked','timeout','rate_limited','server_error','unknown');
CREATE INDEX bill_documents_link_status_idx ON public.bill_documents (link_status,last_checked_at);
CREATE INDEX bill_documents_hash_idx ON public.bill_documents (file_hash) WHERE file_hash IS NOT NULL;

CREATE TABLE public.document_link_checks (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 document_id bigint NOT NULL REFERENCES public.bill_documents(id) ON DELETE CASCADE,
 checked_at timestamptz NOT NULL DEFAULT now(),
 link_status text NOT NULL CHECK (link_status IN
  ('available','broken','timeout','blocked','rate_limited','server_error','invalid_content','unknown')),
 http_status_code smallint CHECK (http_status_code IS NULL OR http_status_code BETWEEN 100 AND 599),
 request_method text CHECK (request_method IS NULL OR request_method IN ('HEAD','GET')),
 content_type text, content_length bigint CHECK (content_length IS NULL OR content_length >= 0),
 final_url text, latency_ms integer CHECK (latency_ms IS NULL OR latency_ms >= 0),
 error_message text
);
CREATE INDEX document_link_checks_recent_idx ON public.document_link_checks (document_id,checked_at DESC);

CREATE TABLE public.bill_ai_content (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 bill_id bigint NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
 source_doc_id bigint REFERENCES public.bill_documents(id) ON DELETE SET NULL,
 provider text, model_version text NOT NULL, prompt_version text,
 plain_title text, summary text, why_it_matters text, topic text,
 key_changes jsonb, confidence_notes text,
 input_char_count integer CHECK (input_char_count IS NULL OR input_char_count >= 0),
 latency_ms integer CHECK (latency_ms IS NULL OR latency_ms >= 0),
 raw_response jsonb,
 review_status text NOT NULL DEFAULT 'generating'
  CHECK (review_status IN ('generating','pending_review','approved','rejected','failed','superseded')),
 error_message text, generated_at timestamptz NOT NULL DEFAULT now(),
 reviewed_by text, reviewed_at timestamptz,
 reviewer_user_id bigint REFERENCES public.users(id) ON DELETE SET NULL,
 published_at timestamptz,
 CONSTRAINT ai_review_consistency CHECK (review_status <> 'approved' OR reviewed_at IS NOT NULL)
);
CREATE INDEX ai_bill_generated_idx ON public.bill_ai_content (bill_id,generated_at DESC,id DESC);
CREATE INDEX ai_review_queue_idx ON public.bill_ai_content (review_status,generated_at DESC);
CREATE INDEX ai_published_idx ON public.bill_ai_content (published_at DESC,id DESC) WHERE review_status='approved';
-- At most one currently approved summary per bill; supersede before approving a new version.
CREATE UNIQUE INDEX ai_one_approved_per_bill_uq ON public.bill_ai_content (bill_id) WHERE review_status='approved';

CREATE TABLE public.processing_jobs (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 bill_id bigint NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
 document_id bigint REFERENCES public.bill_documents(id) ON DELETE SET NULL,
 ai_content_id bigint REFERENCES public.bill_ai_content(id) ON DELETE SET NULL,
 job_type text NOT NULL CHECK (job_type IN ('pdf_extract','ai_summarize','link_check')),
 status text NOT NULL DEFAULT 'queued'
  CHECK (status IN ('queued','running','completed','failed','cancelled')),
 pid integer, requested_by bigint REFERENCES public.users(id) ON DELETE SET NULL,
 priority integer NOT NULL DEFAULT 0, attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
 max_attempts integer NOT NULL DEFAULT 3 CHECK (max_attempts >= 1),
 created_at timestamptz NOT NULL DEFAULT now(), started_at timestamptz,
 finished_at timestamptz, heartbeat_at timestamptz,
 error_message text, worker_id text,
 CONSTRAINT job_finished_after_start CHECK (finished_at IS NULL OR started_at IS NULL OR finished_at >= started_at)
);
CREATE INDEX processing_jobs_queue_idx ON public.processing_jobs (priority DESC,created_at,id) WHERE status='queued';
CREATE INDEX processing_jobs_bill_idx ON public.processing_jobs (bill_id,created_at DESC);
CREATE INDEX processing_jobs_active_idx ON public.processing_jobs (status,heartbeat_at) WHERE status='running';

CREATE TABLE public.processing_job_attempts (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 job_id bigint NOT NULL REFERENCES public.processing_jobs(id) ON DELETE CASCADE,
 attempt_number integer NOT NULL CHECK (attempt_number >= 1),
 started_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz,
 status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','completed','failed','cancelled')),
 error_message text, worker_id text,
 UNIQUE (job_id,attempt_number)
);

CREATE TABLE public.topics (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 slug text NOT NULL UNIQUE, name text NOT NULL UNIQUE,
 description text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.bill_topics (
 bill_id bigint NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
 topic_id bigint NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
 classification_source text NOT NULL DEFAULT 'admin'
  CHECK (classification_source IN ('admin','source','ai')),
 verified_by bigint REFERENCES public.users(id) ON DELETE SET NULL,
 verified_at timestamptz,
 PRIMARY KEY (bill_id,topic_id)
);
CREATE INDEX bill_topics_topic_idx ON public.bill_topics (topic_id,bill_id);

CREATE TABLE public.editorial_assessments (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 bill_id bigint NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
 assessed_by bigint NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
 affected_sectors text[] NOT NULL DEFAULT '{}',
 affected_populations text[] NOT NULL DEFAULT '{}',
 legal_changes text, source_notes text, uncertainty_notes text,
 editorial_notes text, review_status text NOT NULL DEFAULT 'draft'
  CHECK (review_status IN ('draft','submitted','verified','returned')),
 created_at timestamptz NOT NULL DEFAULT now(), reviewed_at timestamptz
);
CREATE INDEX editorial_assessments_bill_idx ON public.editorial_assessments (bill_id,created_at DESC);

CREATE TABLE public.mps (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 name text NOT NULL, house text, state text, constituency text,
 party text, bloc text, term text, terms integer CHECK (terms IS NULL OR terms >= 0),
 education text, committee text, topics text[] NOT NULL DEFAULT '{}', bio text,
 bills_sponsored integer DEFAULT 0 CHECK (bills_sponsored IS NULL OR bills_sponsored >= 0),
 questions_asked integer CHECK (questions_asked IS NULL OR questions_asked >= 0),
 attendance_pct integer CHECK (attendance_pct IS NULL OR attendance_pct BETWEEN 0 AND 100),
 debates_count integer CHECK (debates_count IS NULL OR debates_count >= 0),
 source_raw jsonb
);
CREATE INDEX mps_name_trgm_idx ON public.mps USING gin (name gin_trgm_ops);
CREATE TABLE public.bill_sponsors (
 bill_id bigint NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
 mp_id bigint NOT NULL REFERENCES public.mps(id) ON DELETE CASCADE,
 PRIMARY KEY (bill_id,mp_id)
);
CREATE INDEX bill_sponsors_mp_idx ON public.bill_sponsors (mp_id,bill_id);

CREATE TABLE public.comments (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 bill_id bigint NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
 user_id bigint NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
 body text NOT NULL CHECK (length(btrim(body)) > 0),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX comments_bill_created_idx ON public.comments (bill_id,created_at DESC);
CREATE TABLE public.follows (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 user_id bigint NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK (kind IN ('bill','topic','mp')),
 target_id text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (user_id,kind,target_id)
);
CREATE INDEX follows_user_idx ON public.follows (user_id,kind);

-- Operational view: never conflate document URL health with extraction state.
CREATE VIEW public.bill_document_overview AS
SELECT b.id AS bill_id, b.bill_name,
 count(d.id) AS document_count,
 count(d.id) FILTER (WHERE d.link_status='available') AS available_links,
 count(d.id) FILTER (WHERE d.link_status IN ('broken','invalid_content')) AS broken_links,
 count(d.id) FILTER (WHERE d.link_status='unchecked') AS unchecked_links,
 count(d.id) FILTER (WHERE d.extraction_status='done') AS extracted_documents,
 count(d.id) FILTER (WHERE d.extraction_status='failed') AS failed_extractions
FROM public.bills b LEFT JOIN public.bill_documents d ON d.bill_id=b.id
GROUP BY b.id,b.bill_name;

-- Public feed: only approved, explicitly reviewed content, never all AI generations.
CREATE VIEW public.published_bill_feed AS
SELECT b.id AS bill_id,b.bill_name,b.bill_number,b.bill_year,b.introduced_house,
 b.ministry_name,b.bill_category,b.normalized_status,b.latest_movement_at,
 a.id AS ai_content_id,a.plain_title,a.summary,a.why_it_matters,a.topic,
 a.key_changes,a.reviewed_at,a.published_at
FROM public.bills b JOIN public.bill_ai_content a ON a.bill_id=b.id
WHERE a.review_status='approved' AND a.published_at IS NOT NULL;

COMMIT;
