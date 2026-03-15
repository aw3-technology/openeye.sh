-- Fleet & Device Management tables
-- Supports device registration, heartbeats, staged deployments, maintenance windows, alerts, and command queue.

-- ============================================================
-- 1. devices  (extends the base table from 20260315 migration)
-- ============================================================
-- The dashboard migration (20260315) may have already created a simpler devices table.
-- We use IF NOT EXISTS and then ALTER TABLE to add fleet-specific columns.
CREATE TABLE IF NOT EXISTS public.devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  device_type TEXT NOT NULL DEFAULT 'edge_node',
  status TEXT NOT NULL DEFAULT 'pending',
  api_key_hash TEXT,
  hardware_specs JSONB NOT NULL DEFAULT '{}',
  tags JSONB NOT NULL DEFAULT '{}',
  config_overrides JSONB NOT NULL DEFAULT '{}',
  firmware_version TEXT,
  current_model_id TEXT,
  current_model_version TEXT,
  ip_address TEXT,
  last_heartbeat_at TIMESTAMPTZ,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add fleet-specific columns if they don't exist yet (safe for re-runs)
ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS api_key_hash TEXT;
ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS hardware_specs JSONB NOT NULL DEFAULT '{}';
ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '{}';
ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS config_overrides JSONB NOT NULL DEFAULT '{}';
ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS firmware_version TEXT;
ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS current_model_id TEXT;
ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS current_model_version TEXT;
ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS ip_address TEXT;
ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS last_heartbeat_at TIMESTAMPTZ;
ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS registered_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

-- Policies are created with IF NOT EXISTS pattern via DO blocks
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'devices' AND policyname = 'fleet_users_view_own_devices') THEN
    CREATE POLICY "fleet_users_view_own_devices" ON public.devices FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'devices' AND policyname = 'fleet_users_insert_own_devices') THEN
    CREATE POLICY "fleet_users_insert_own_devices" ON public.devices FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'devices' AND policyname = 'fleet_users_update_own_devices') THEN
    CREATE POLICY "fleet_users_update_own_devices" ON public.devices FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'devices' AND policyname = 'fleet_users_delete_own_devices') THEN
    CREATE POLICY "fleet_users_delete_own_devices" ON public.devices FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE OR REPLACE TRIGGER update_devices_updated_at
  BEFORE UPDATE ON public.devices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE UNIQUE INDEX IF NOT EXISTS idx_devices_user_name ON public.devices(user_id, name) WHERE status != 'decommissioned';
CREATE INDEX IF NOT EXISTS idx_devices_user_id ON public.devices(user_id);
CREATE INDEX IF NOT EXISTS idx_devices_user_status ON public.devices(user_id, status);

-- ============================================================
-- 2. device_groups
-- ============================================================
CREATE TABLE public.device_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  tag_filter JSONB NOT NULL DEFAULT '{}',
  auto_scaling_policy JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.device_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own device_groups"
  ON public.device_groups FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own device_groups"
  ON public.device_groups FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own device_groups"
  ON public.device_groups FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own device_groups"
  ON public.device_groups FOR DELETE USING (auth.uid() = user_id);

CREATE UNIQUE INDEX idx_device_groups_user_name ON public.device_groups(user_id, name);

CREATE TRIGGER update_device_groups_updated_at
  BEFORE UPDATE ON public.device_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 3. device_group_members
-- ============================================================
CREATE TABLE public.device_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.device_groups(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(group_id, device_id)
);

ALTER TABLE public.device_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own device_group_members"
  ON public.device_group_members FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.device_groups g WHERE g.id = group_id AND g.user_id = auth.uid()
  ));
CREATE POLICY "Users can insert own device_group_members"
  ON public.device_group_members FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.device_groups g WHERE g.id = group_id AND g.user_id = auth.uid()
  ));
CREATE POLICY "Users can delete own device_group_members"
  ON public.device_group_members FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.device_groups g WHERE g.id = group_id AND g.user_id = auth.uid()
  ));

-- ============================================================
-- 4. heartbeats
-- NOTE: This table grows fast (~4 rows/min per device at 15s interval).
-- Recommend partitioning by month and a 30-day retention policy via pg_cron.
-- ============================================================
CREATE TABLE public.heartbeats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  resource_usage JSONB NOT NULL DEFAULT '{}',
  firmware_version TEXT,
  model_version TEXT,
  agent_version TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.heartbeats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view heartbeats for own devices"
  ON public.heartbeats FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.devices d WHERE d.id = device_id AND d.user_id = auth.uid()
  ));
CREATE POLICY "Allow device heartbeat insert"
  ON public.heartbeats FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.devices d WHERE d.id = device_id
  ));

CREATE INDEX idx_heartbeats_device_id ON public.heartbeats(device_id);
CREATE INDEX idx_heartbeats_device_created ON public.heartbeats(device_id, created_at);

-- ============================================================
-- 5. deployments
-- ============================================================
CREATE TABLE public.deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  model_id TEXT NOT NULL,
  model_version TEXT NOT NULL,
  model_url TEXT,
  model_checksum TEXT,
  strategy TEXT NOT NULL DEFAULT 'canary'
    CHECK (strategy IN ('canary', 'rolling', 'blue_green', 'all_at_once')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'paused', 'completed', 'rolling_back', 'rolled_back', 'failed')),
  rollout_stages JSONB NOT NULL DEFAULT '[]',
  current_stage INTEGER NOT NULL DEFAULT 0,
  target_device_ids UUID[] DEFAULT '{}',
  target_group_id UUID REFERENCES public.device_groups(id) ON DELETE SET NULL,
  bandwidth_limit_mbps DOUBLE PRECISION CHECK (bandwidth_limit_mbps IS NULL OR bandwidth_limit_mbps > 0),
  rollback_version TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.deployments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own deployments"
  ON public.deployments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own deployments"
  ON public.deployments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own deployments"
  ON public.deployments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own deployments"
  ON public.deployments FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_deployments_updated_at
  BEFORE UPDATE ON public.deployments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_deployments_user_status ON public.deployments(user_id, status);

-- ============================================================
-- 6. deployment_device_status
-- ============================================================
CREATE TABLE public.deployment_device_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deployment_id UUID NOT NULL REFERENCES public.deployments(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'rolled_back')),
  stage INTEGER NOT NULL DEFAULT 0,
  progress DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(deployment_id, device_id)
);

ALTER TABLE public.deployment_device_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own deployment_device_status"
  ON public.deployment_device_status FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.deployments d WHERE d.id = deployment_id AND d.user_id = auth.uid()
  ));
CREATE POLICY "Users can insert own deployment_device_status"
  ON public.deployment_device_status FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.deployments d WHERE d.id = deployment_id AND d.user_id = auth.uid()
  ));
CREATE POLICY "Users can update own deployment_device_status"
  ON public.deployment_device_status FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.deployments d WHERE d.id = deployment_id AND d.user_id = auth.uid()
  ));

CREATE TRIGGER update_deployment_device_status_updated_at
  BEFORE UPDATE ON public.deployment_device_status
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 7. maintenance_windows
-- ============================================================
CREATE TABLE public.maintenance_windows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  device_ids UUID[] DEFAULT '{}',
  group_id UUID REFERENCES public.device_groups(id) ON DELETE SET NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  recurrence TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT maintenance_window_time_range CHECK (ends_at > starts_at)
);

ALTER TABLE public.maintenance_windows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own maintenance_windows"
  ON public.maintenance_windows FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own maintenance_windows"
  ON public.maintenance_windows FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own maintenance_windows"
  ON public.maintenance_windows FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own maintenance_windows"
  ON public.maintenance_windows FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_maintenance_windows_updated_at
  BEFORE UPDATE ON public.maintenance_windows
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 8. fleet_alerts
-- ============================================================
CREATE TABLE public.fleet_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id UUID REFERENCES public.devices(id) ON DELETE SET NULL,
  deployment_id UUID REFERENCES public.deployments(id) ON DELETE SET NULL,
  alert_type TEXT NOT NULL
    CHECK (alert_type IN ('device_offline', 'high_resource_usage', 'deployment_failed', 'ota_failed', 'heartbeat_missed', 'temperature_high', 'disk_full')),
  severity TEXT NOT NULL DEFAULT 'warning'
    CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  title TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.fleet_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own fleet_alerts"
  ON public.fleet_alerts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own fleet_alerts"
  ON public.fleet_alerts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own fleet_alerts"
  ON public.fleet_alerts FOR UPDATE USING (auth.uid() = user_id);

CREATE INDEX idx_fleet_alerts_user_resolved ON public.fleet_alerts(user_id, resolved, created_at);

-- ============================================================
-- 9. device_commands
-- ============================================================
CREATE TABLE public.device_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  command_type TEXT NOT NULL
    CHECK (command_type IN ('restart', 'update_config', 'deploy_model', 'rollback_model', 'ota_update', 'decommission', 'collect_logs')),
  payload JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'acked', 'in_progress', 'completed', 'failed')),
  result JSONB,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  acked_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

ALTER TABLE public.device_commands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own device_commands"
  ON public.device_commands FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own device_commands"
  ON public.device_commands FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own device_commands"
  ON public.device_commands FOR UPDATE USING (auth.uid() = user_id);

CREATE INDEX idx_device_commands_device_status ON public.device_commands(device_id, status);
CREATE INDEX idx_device_commands_device_issued ON public.device_commands(device_id, status, issued_at);
