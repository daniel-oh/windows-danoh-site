-- Dedup table for Stripe webhook events. Stripe retries webhooks
-- on network timeouts, server errors, or anything that doesn't
-- 2xx within the retry window. Without an idempotency check, a
-- retried checkout.session.completed would double-credit tokens.
--
-- The handler inserts event.id here as its first DB write. The
-- primary-key unique violation on a retry is the signal to short-
-- circuit and respond 200 without re-running side effects.

CREATE TABLE IF NOT EXISTS public.stripe_events (
  event_id    TEXT PRIMARY KEY,
  type        TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- No RLS — only the service role inserts here from the webhook
-- handler. No public read/write.
ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;
