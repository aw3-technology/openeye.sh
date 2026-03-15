-- API usage log for hosted inference endpoints
CREATE TABLE IF NOT EXISTS public.api_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  model TEXT,
  credits_used INTEGER NOT NULL DEFAULT 0,
  inference_ms DOUBLE PRECISION,
  status_code INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.api_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own API usage"
  ON public.api_usage_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert API usage"
  ON public.api_usage_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Indexes for rate limiting (key + time window) and user queries
CREATE INDEX idx_api_usage_log_key_created
  ON public.api_usage_log (api_key_id, created_at DESC);

CREATE INDEX idx_api_usage_log_user_created
  ON public.api_usage_log (user_id, created_at DESC);

-- Add scopes and rate_limit columns to existing api_keys table
ALTER TABLE public.api_keys
  ADD COLUMN IF NOT EXISTS scopes TEXT[] DEFAULT ARRAY['inference']::TEXT[];

ALTER TABLE public.api_keys
  ADD COLUMN IF NOT EXISTS rate_limit INTEGER DEFAULT 60;
