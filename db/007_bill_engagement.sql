-- Per-user bill reactions and unique-reader view counts.
-- Safe to re-run against an existing NationPulse database.
CREATE TABLE IF NOT EXISTS public.bill_reactions (
  bill_id bigint NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  user_id bigint NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reaction text NOT NULL CHECK (reaction IN ('like', 'dislike')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bill_id, user_id)
);
CREATE INDEX IF NOT EXISTS bill_reactions_bill_idx
  ON public.bill_reactions (bill_id, reaction);

CREATE TABLE IF NOT EXISTS public.bill_views (
  bill_id bigint NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  user_id bigint NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bill_id, user_id)
);
CREATE INDEX IF NOT EXISTS bill_views_bill_idx
  ON public.bill_views (bill_id);
