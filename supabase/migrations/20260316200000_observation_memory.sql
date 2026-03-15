-- Observation memory table for cloud-stored agentic pipeline observations

CREATE TABLE IF NOT EXISTS public.observation_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tick INTEGER NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT now() NOT NULL,
  detections_json JSONB DEFAULT '[]'::jsonb,
  scene_summary TEXT DEFAULT '',
  change_description TEXT DEFAULT '',
  significance REAL DEFAULT 0.0 CHECK (significance >= 0.0 AND significance <= 1.0),
  tags TEXT[] DEFAULT '{}',
  session_id TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Row-level security
ALTER TABLE public.observation_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own observations"
  ON public.observation_memory FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own observations"
  ON public.observation_memory FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own observations"
  ON public.observation_memory FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes for common queries
CREATE INDEX idx_observation_memory_user_timestamp
  ON public.observation_memory (user_id, timestamp DESC);

CREATE INDEX idx_observation_memory_significance
  ON public.observation_memory (user_id, significance DESC);

CREATE INDEX idx_observation_memory_session
  ON public.observation_memory (user_id, session_id);
