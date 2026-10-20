-- NationPulse QA-only schema. Safe to apply alongside the main NationPulse schema.
-- All objects are deliberately prefixed qa_ so no main application table/function is changed.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.qa_bills (
    bill_id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    bill_number TEXT,
    bill_year TEXT,
    bill_type TEXT,
    bill_category TEXT,
    ministry TEXT,
    house TEXT DEFAULT 'Lok Sabha',
    status TEXT DEFAULT 'Introduced',
    introduced_date DATE,
    passed_ls_date DATE,
    passed_rs_date DATE,
    source_url TEXT,
    summary TEXT,
    is_indexed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.qa_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id TEXT REFERENCES public.qa_bills(bill_id) ON DELETE SET NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    refined_query TEXT,
    refinement_iterations INT DEFAULT 1,
    sources JSONB DEFAULT '[]'::jsonb,
    feedback_rating INT DEFAULT NULL,
    user_id UUID DEFAULT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.qa_bill_discussions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id TEXT REFERENCES public.qa_bills(bill_id) ON DELETE CASCADE,
    user_id UUID DEFAULT NULL,
    author_name TEXT DEFAULT 'Anonymous Citizen',
    comment TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qa_bills_status ON public.qa_bills(status);
CREATE INDEX IF NOT EXISTS idx_qa_bills_ministry ON public.qa_bills(ministry);
CREATE INDEX IF NOT EXISTS idx_qa_interactions_bill_id ON public.qa_interactions(bill_id);
CREATE INDEX IF NOT EXISTS idx_qa_interactions_created_at ON public.qa_interactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qa_bill_discussions_bill_id ON public.qa_bill_discussions(bill_id);

ALTER TABLE public.qa_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qa_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qa_bill_discussions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "QA public read bills" ON public.qa_bills;
CREATE POLICY "QA public read bills" ON public.qa_bills FOR SELECT USING (true);
DROP POLICY IF EXISTS "QA service role manages bills" ON public.qa_bills;
CREATE POLICY "QA service role manages bills" ON public.qa_bills FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
DROP POLICY IF EXISTS "QA public read interactions" ON public.qa_interactions;
CREATE POLICY "QA public read interactions" ON public.qa_interactions FOR SELECT USING (true);
DROP POLICY IF EXISTS "QA public insert interactions" ON public.qa_interactions;
CREATE POLICY "QA public insert interactions" ON public.qa_interactions FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "QA public update feedback" ON public.qa_interactions;
CREATE POLICY "QA public update feedback" ON public.qa_interactions FOR UPDATE USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "QA public read discussions" ON public.qa_bill_discussions;
CREATE POLICY "QA public read discussions" ON public.qa_bill_discussions FOR SELECT USING (true);
DROP POLICY IF EXISTS "QA public insert discussions" ON public.qa_bill_discussions;
CREATE POLICY "QA public insert discussions" ON public.qa_bill_discussions FOR INSERT WITH CHECK (true);

-- Add QA-owned tables to Realtime only when not already published.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='qa_bills') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.qa_bills;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='qa_interactions') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.qa_interactions;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='qa_bill_discussions') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.qa_bill_discussions;
  END IF;
END $$;
