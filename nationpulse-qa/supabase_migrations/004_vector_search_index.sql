-- Speed up cosine similarity retrieval on the QA chunk embeddings.
-- Run with psql over a direct or Supavisor session-mode connection (port 5432),
-- not the Dashboard SQL Editor: its query timeout can cancel large index builds.
-- Do not wrap this file in a transaction; CREATE INDEX CONCURRENTLY requires this.

SET statement_timeout = '30min';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_qa_bill_chunks_embedding_hnsw
    ON public.qa_bill_chunks
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

ANALYZE public.qa_bill_chunks;

-- If a previous CONCURRENTLY attempt was cancelled, check pg_index.indisvalid.
-- Drop an invalid leftover before retrying:
-- DROP INDEX CONCURRENTLY IF EXISTS public.idx_qa_bill_chunks_embedding_hnsw;
