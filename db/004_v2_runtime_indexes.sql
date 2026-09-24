-- Run against your already-created NationPulse V2 database (safe to re-run).
CREATE UNIQUE INDEX IF NOT EXISTS processing_jobs_one_active_per_bill_type
ON public.processing_jobs(bill_id,job_type) WHERE status IN ('queued','running');
CREATE UNIQUE INDEX IF NOT EXISTS bill_ai_one_generating_per_bill
ON public.bill_ai_content(bill_id) WHERE review_status='generating';
-- NULL event_house needs an expression index to prevent repeated undated-house events.
CREATE UNIQUE INDEX IF NOT EXISTS bill_movements_null_house_dedup
ON public.bill_movements(bill_id,event_type,event_date) WHERE event_house IS NULL;
