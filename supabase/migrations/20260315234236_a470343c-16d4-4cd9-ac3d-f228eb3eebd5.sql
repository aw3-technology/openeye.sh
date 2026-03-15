
-- =============================================
-- FLEET MANAGEMENT: Extend devices + new tables
-- =============================================

-- 1. Extend existing devices table with fleet columns
ALTER TABLE public.devices
  ADD COLUMN IF NOT EXISTS hardware_specs jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS tags jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS config_overrides jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS firmware_version text,
  ADD COLUMN IF NOT EXISTS current_model_id text,
  ADD COLUMN IF NOT EXISTS current_model_version text,
  ADD COLUMN IF NOT EXISTS ip_address text,
  ADD COLUMN IF NOT EXISTS last_heartbeat_at timestamptz,
  ADD COLUMN IF NOT EXISTS registered_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 2. Deployments
CREATE TABLE public.deployments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  model_id text NOT NULL,
  model_version text NOT NULL,
  model_url text,
  model_checksum text,
  strategy text NOT NULL DEFAULT 'rolling',
  status text NOT NULL DEFAULT 'pending',
  rollout_stages jsonb DEFAULT '[]'::jsonb,
  current_stage int DEFAULT 0,
  target_device_ids jsonb DEFAULT '[]'::jsonb,
  target_group_id uuid,
  bandwidth_limit_mbps numeric,
  rollback_version text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.deployments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own deployments" ON public.deployments FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own deployments" ON public.deployments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own deployments" ON public.deployments FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own deployments" ON public.deployments FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 3. Deployment device status
CREATE TABLE public.deployment_device_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deployment_id uuid NOT NULL REFERENCES public.deployments(id) ON DELETE CASCADE,
  device_id uuid NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  stage int DEFAULT 0,
  progress numeric DEFAULT 0,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.deployment_device_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own deployment device status" ON public.deployment_device_status FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own deployment device status" ON public.deployment_device_status FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own deployment device status" ON public.deployment_device_status FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own deployment device status" ON public.deployment_device_status FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 4. Device groups
CREATE TABLE public.device_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text DEFAULT '',
  tag_filter jsonb DEFAULT '{}'::jsonb,
  auto_scaling_policy jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.device_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own groups" ON public.device_groups FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own groups" ON public.device_groups FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own groups" ON public.device_groups FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own groups" ON public.device_groups FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 5. Group members (junction)
CREATE TABLE public.group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.device_groups(id) ON DELETE CASCADE,
  device_id uuid NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(group_id, device_id)
);
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own group members" ON public.group_members FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own group members" ON public.group_members FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own group members" ON public.group_members FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 6. Maintenance windows
CREATE TABLE public.maintenance_windows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text DEFAULT '',
  device_ids jsonb DEFAULT '[]'::jsonb,
  group_id uuid REFERENCES public.device_groups(id) ON DELETE SET NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  recurrence text,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.maintenance_windows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own maintenance windows" ON public.maintenance_windows FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own maintenance windows" ON public.maintenance_windows FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own maintenance windows" ON public.maintenance_windows FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own maintenance windows" ON public.maintenance_windows FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 7. Fleet alerts
CREATE TABLE public.fleet_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  device_id uuid REFERENCES public.devices(id) ON DELETE SET NULL,
  deployment_id uuid REFERENCES public.deployments(id) ON DELETE SET NULL,
  alert_type text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  message text NOT NULL DEFAULT '',
  resolved boolean DEFAULT false,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.fleet_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own alerts" ON public.fleet_alerts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own alerts" ON public.fleet_alerts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own alerts" ON public.fleet_alerts FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own alerts" ON public.fleet_alerts FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 8. Device resource history
CREATE TABLE public.device_resource_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  resource_usage jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.device_resource_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own resource history" ON public.device_resource_history FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own resource history" ON public.device_resource_history FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Trigger for updated_at on new tables
CREATE TRIGGER set_devices_updated_at BEFORE UPDATE ON public.devices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_deployments_updated_at BEFORE UPDATE ON public.deployments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_device_groups_updated_at BEFORE UPDATE ON public.device_groups FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_maintenance_windows_updated_at BEFORE UPDATE ON public.maintenance_windows FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
