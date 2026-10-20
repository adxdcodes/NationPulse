-- Restore the privileges required by the NationPulse QA API.
-- Run in the Supabase SQL Editor as the project owner. Safe to re-run.
-- Keep these grants limited to service_role: the API uses the service key.

GRANT SELECT, INSERT, UPDATE, DELETE
    ON TABLE public.qa_bills, public.qa_bill_chunks
    TO service_role;

GRANT EXECUTE ON FUNCTION public.qa_list_indexed_bills()
    TO service_role;

GRANT EXECUTE ON FUNCTION public.qa_match_bill_chunks(
    vector, integer, text, text
) TO service_role;

NOTIFY pgrst, 'reload schema';
