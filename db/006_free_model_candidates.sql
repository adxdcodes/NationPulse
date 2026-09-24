-- Run AFTER db/005_ai_model_scheduler.sql.
-- Conservative STARTER PLACEHOLDERS, NOT GOOGLE-PUBLISHED QUOTAS.
-- Update each row to your project's actual free-tier RPM/RPD/TPM in AI Studio.
-- Only inserts missing rows; preserves your existing limits and usage.
INSERT INTO public.ai_model_limits(model_id, requests_per_minute, requests_per_day, tokens_per_minute)
VALUES
  ('gemini-3.5-flash-lite', 1, 5, 50000),
  ('gemini-3.1-flash-lite', 1, 5, 50000),
  ('gemini-3.5-flash', 1, 5, 50000),
  ('gemini-3-flash-preview', 1, 5, 50000),
  ('gemini-2.5-flash-lite', 1, 5, 50000),
  ('gemini-2.5-flash', 1, 5, 50000)
ON CONFLICT (model_id) DO NOTHING;

-- Exclude paid-only Pro preview from any legacy configuration.
UPDATE public.ai_model_limits SET enabled = false
WHERE model_id IN ('gemini-3.1-pro-preview');

SELECT model_id, enabled, requests_per_minute, requests_per_day,
       tokens_per_minute, cooldown_until FROM public.ai_model_limits
ORDER BY model_id;
