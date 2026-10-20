-- NationPulse QA-only pgvector migration. Does not alter public.bills or main RPCs.
-- Run schema.sql first. Safe to re-run.
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.qa_bill_chunks (
    chunk_id TEXT PRIMARY KEY,
    bill_id TEXT NOT NULL REFERENCES public.qa_bills(bill_id) ON DELETE CASCADE,
    bill_title TEXT,
    chunk_index INT,
    content TEXT NOT NULL,
    embedding vector(384) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qa_bill_chunks_bill_id ON public.qa_bill_chunks(bill_id);
CREATE INDEX IF NOT EXISTS idx_qa_bill_chunks_bill_title ON public.qa_bill_chunks(bill_title);
CREATE INDEX IF NOT EXISTS idx_qa_bills_is_indexed ON public.qa_bills(is_indexed);

CREATE OR REPLACE FUNCTION public.qa_match_bill_chunks(
    query_embedding vector(384),
    match_count INT DEFAULT 15,
    filter_bill_id TEXT DEFAULT NULL,
    filter_bill_title TEXT DEFAULT NULL
)
RETURNS TABLE (
    chunk_id TEXT,
    bill_id TEXT,
    bill_title TEXT,
    chunk_index INT,
    content TEXT,
    similarity FLOAT
)
LANGUAGE sql STABLE
AS $$
    SELECT c.chunk_id, c.bill_id, c.bill_title, c.chunk_index, c.content,
           1 - (c.embedding <=> query_embedding) AS similarity
    FROM public.qa_bill_chunks c
    WHERE (filter_bill_id IS NULL OR c.bill_id = filter_bill_id)
      AND (filter_bill_title IS NULL OR c.bill_title = filter_bill_title)
    ORDER BY c.embedding <=> query_embedding
    LIMIT match_count;
$$;

CREATE OR REPLACE FUNCTION public.qa_list_indexed_bills()
RETURNS TABLE (bill_id TEXT, bill_title TEXT, chunk_count BIGINT)
LANGUAGE sql STABLE
AS $$
    SELECT c.bill_id, MAX(c.bill_title), COUNT(*)
    FROM public.qa_bill_chunks c
    GROUP BY c.bill_id;
$$;

ALTER TABLE public.qa_bill_chunks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "QA public read chunks" ON public.qa_bill_chunks;
CREATE POLICY "QA public read chunks" ON public.qa_bill_chunks FOR SELECT USING (true);
