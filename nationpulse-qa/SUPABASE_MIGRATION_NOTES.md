# Supabase integration: NationPulse QA

The QA subsystem is isolated from the main NationPulse schema by using QA-prefixed database objects. Apply these scripts in the **same Supabase project** as the main application:

1. Run `supabase_migrations/schema.sql`.
2. Run `supabase_migrations/002_pgvector_rag.sql`.
3. Run `supabase_migrations/003_service_role_privileges.sql` to grant the API's `service_role` access to the QA tables and RPCs. This repairs deployments where those privileges were revoked or omitted.
4. Run `supabase_migrations/004_vector_search_index.sql` with `psql` over a direct or Supavisor session-mode connection (port 5432) to create the HNSW cosine index used by bill Q&A retrieval. Do not run this 100k-row build in the Dashboard SQL Editor, which has a 60-second limit, or wrap it in a transaction. Apply this if requests fail with PostgreSQL statement timeout `57014`.

## QA-owned objects

- `public.qa_bills` — QA module's bill metadata and `is_indexed` flag.
- `public.qa_interactions` — citizen Q&A history and feedback.
- `public.qa_bill_discussions` — QA module discussion comments.
- `public.qa_bill_chunks` — text chunks and 384-dimensional embeddings.
- `public.qa_match_bill_chunks(...)` — similarity-search RPC (the app also recognizes `match_bill_chunks(...)`).
- `public.qa_list_indexed_bills()` — indexed bill listing RPC (the app also recognizes `list_indexed_bills()`).

The QA scripts do **not** create, alter, or add columns to `public.bills`, `public.bill_documents`, or other main application tables. They also do not replace the main application's RPC functions. QA's own `qa_bills` is intentionally separate, so ingestion and QA queries use QA metadata without modifying the main bill records.

Both scripts are designed to be re-runnable. The Realtime setup checks membership before adding tables to `supabase_realtime`.

## Existing deployment note

If the old QA migration was previously run, its legacy unprefixed objects may still exist. The updated migration creates and uses the QA-prefixed objects and leaves legacy/main objects untouched; it does not automatically delete or migrate existing rows. Back up any data before manually removing obsolete legacy objects.
