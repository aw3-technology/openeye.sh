-- Fix #17: Add index on api_keys.key_hash for O(1) auth lookups
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash
  ON public.api_keys (key_hash);

-- Fix #18: Add index on devices.api_key_hash for O(1) auth lookups
CREATE INDEX IF NOT EXISTS idx_devices_api_key_hash
  ON public.devices (api_key_hash);

-- Fix #16: Heartbeat INSERT policy should only allow inserts for devices owned by the user
DROP POLICY IF EXISTS "Allow device heartbeat insert" ON public.heartbeats;
CREATE POLICY "Allow device heartbeat insert for owned devices"
  ON public.heartbeats FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.devices d
    WHERE d.id = device_id AND d.user_id = auth.uid()
  ));

-- Fix #15: Heartbeats retention — auto-delete rows older than 30 days
-- This function can be called by pg_cron or a scheduled Edge Function.
CREATE OR REPLACE FUNCTION public.cleanup_old_heartbeats()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  DELETE FROM public.heartbeats
  WHERE created_at < now() - interval '30 days';
$$;

-- If pg_cron is available, schedule daily cleanup:
-- SELECT cron.schedule('heartbeat-cleanup', '0 3 * * *', 'SELECT public.cleanup_old_heartbeats()');
