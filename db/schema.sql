-- OpenEye schema for Neon Postgres.
-- Idempotent: safe to re-run (`npm run db:migrate`).
--
-- Replaces the Lovable Cloud (Supabase) schema. Row-level security is gone:
-- every query in api/ is scoped to the signed-in user's id instead.

create extension if not exists pgcrypto;

-- ── Auth (Better Auth) ─────────────────────────────────────────

create table if not exists "user" (
  "id" text not null primary key,
  "name" text not null,
  "email" text not null unique,
  "emailVerified" boolean not null,
  "image" text,
  "createdAt" timestamptz default current_timestamp not null,
  "updatedAt" timestamptz default current_timestamp not null
);

create table if not exists "session" (
  "id" text not null primary key,
  "expiresAt" timestamptz not null,
  "token" text not null unique,
  "createdAt" timestamptz default current_timestamp not null,
  "updatedAt" timestamptz not null,
  "ipAddress" text,
  "userAgent" text,
  "userId" text not null references "user" ("id") on delete cascade
);

create table if not exists "account" (
  "id" text not null primary key,
  "accountId" text not null,
  "providerId" text not null,
  "userId" text not null references "user" ("id") on delete cascade,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" timestamptz,
  "refreshTokenExpiresAt" timestamptz,
  "scope" text,
  "password" text,
  "createdAt" timestamptz default current_timestamp not null,
  "updatedAt" timestamptz not null
);

create table if not exists "verification" (
  "id" text not null primary key,
  "identifier" text not null,
  "value" text not null,
  "expiresAt" timestamptz not null,
  "createdAt" timestamptz default current_timestamp not null,
  "updatedAt" timestamptz default current_timestamp not null
);

create index if not exists "session_userId_idx" on "session" ("userId");
create index if not exists "account_userId_idx" on "account" ("userId");
create index if not exists "verification_identifier_idx" on "verification" ("identifier");

-- ── Shared trigger ─────────────────────────────────────────────

create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ── Dashboard ──────────────────────────────────────────────────

create table if not exists inference_history (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references "user" ("id") on delete cascade,
  model text not null,
  task text not null default 'detection',
  timestamp text,
  image_width integer not null default 0,
  image_height integer not null default 0,
  image_source text not null default 'upload',
  object_count integer not null default 0,
  objects_json text not null default '[]',
  inference_ms double precision not null default 0,
  thumbnail_url text,
  created_at timestamptz not null default now()
);
create index if not exists idx_inference_history_user_created on inference_history (user_id, created_at desc);

create table if not exists api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references "user" ("id") on delete cascade,
  name text not null default 'Unnamed Key',
  key_prefix text not null,
  key_hash text not null,
  scopes text[] default array['inference']::text[],
  rate_limit integer default 60,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_api_keys_user on api_keys (user_id);
create index if not exists idx_api_keys_key_hash on api_keys (key_hash);

create table if not exists api_usage_log (
  id uuid primary key default gen_random_uuid(),
  api_key_id uuid not null references api_keys (id) on delete cascade,
  user_id text not null references "user" ("id") on delete cascade,
  endpoint text not null,
  model text,
  credits_used integer not null default 0,
  inference_ms double precision,
  status_code integer not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_api_usage_log_key_created on api_usage_log (api_key_id, created_at desc);
create index if not exists idx_api_usage_log_user_created on api_usage_log (user_id, created_at desc);

create table if not exists observation_memory (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references "user" ("id") on delete cascade,
  tick integer not null,
  timestamp timestamptz not null default now(),
  detections_json jsonb default '[]'::jsonb,
  scene_summary text default '',
  change_description text default '',
  significance real default 0.0 check (significance >= 0.0 and significance <= 1.0),
  tags text[] default '{}',
  session_id text default '',
  created_at timestamptz default now()
);
create index if not exists idx_observation_memory_user_timestamp on observation_memory (user_id, timestamp desc);
create index if not exists idx_observation_memory_session on observation_memory (user_id, session_id);

-- ── Fleet ──────────────────────────────────────────────────────

create table if not exists devices (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references "user" ("id") on delete cascade,
  name text not null default 'Unnamed Device',
  device_type text default 'edge_node',
  status text default 'pending',
  api_key_hash text,
  hardware_specs jsonb default '{}'::jsonb,
  tags jsonb default '{}'::jsonb,
  config_overrides jsonb default '{}'::jsonb,
  metadata jsonb default '{}'::jsonb,
  firmware_version text,
  current_model_id text,
  current_model_version text,
  ip_address text,
  server_url text,
  last_seen_at timestamptz,
  last_heartbeat_at timestamptz,
  registered_at timestamptz default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_devices_user_status on devices (user_id, status);
create index if not exists idx_devices_api_key_hash on devices (api_key_hash);
create or replace trigger update_devices_updated_at
  before update on devices for each row execute function update_updated_at_column();

create table if not exists device_resource_history (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references devices (id) on delete cascade,
  user_id text not null references "user" ("id") on delete cascade,
  resource_usage jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_device_resource_history_device on device_resource_history (device_id, created_at desc);

create table if not exists device_groups (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references "user" ("id") on delete cascade,
  name text not null,
  description text default '',
  tag_filter jsonb default '{}'::jsonb,
  auto_scaling_policy jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_device_groups_user on device_groups (user_id);
create or replace trigger update_device_groups_updated_at
  before update on device_groups for each row execute function update_updated_at_column();

create table if not exists group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references device_groups (id) on delete cascade,
  device_id uuid not null references devices (id) on delete cascade,
  user_id text not null references "user" ("id") on delete cascade,
  created_at timestamptz not null default now(),
  unique (group_id, device_id)
);

create table if not exists deployments (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references "user" ("id") on delete cascade,
  name text not null,
  model_id text not null,
  model_version text not null,
  model_url text,
  model_checksum text,
  strategy text not null default 'rolling',
  status text not null default 'pending',
  rollout_stages jsonb default '[]'::jsonb,
  current_stage integer default 0,
  target_device_ids jsonb default '[]'::jsonb,
  target_group_id uuid references device_groups (id) on delete set null,
  bandwidth_limit_mbps numeric,
  rollback_version text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_deployments_user_status on deployments (user_id, status);
create or replace trigger update_deployments_updated_at
  before update on deployments for each row execute function update_updated_at_column();

create table if not exists deployment_device_status (
  id uuid primary key default gen_random_uuid(),
  deployment_id uuid not null references deployments (id) on delete cascade,
  device_id uuid not null references devices (id) on delete cascade,
  user_id text not null references "user" ("id") on delete cascade,
  status text not null default 'pending',
  stage integer default 0,
  progress numeric default 0,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_deployment_device_status_deployment on deployment_device_status (deployment_id);

create table if not exists maintenance_windows (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references "user" ("id") on delete cascade,
  name text not null,
  description text default '',
  device_ids jsonb default '[]'::jsonb,
  group_id uuid references device_groups (id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  recurrence text,
  is_active boolean default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_maintenance_windows_user on maintenance_windows (user_id);
create or replace trigger update_maintenance_windows_updated_at
  before update on maintenance_windows for each row execute function update_updated_at_column();

create table if not exists fleet_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references "user" ("id") on delete cascade,
  device_id uuid references devices (id) on delete set null,
  deployment_id uuid references deployments (id) on delete set null,
  alert_type text not null,
  severity text not null default 'info',
  title text not null,
  message text not null default '',
  resolved boolean default false,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_fleet_alerts_user_resolved on fleet_alerts (user_id, resolved, created_at);

-- Used by the self-hosted fleet control plane (backend/).
create table if not exists heartbeats (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references devices (id) on delete cascade,
  resource_usage jsonb not null default '{}'::jsonb,
  firmware_version text,
  model_version text,
  agent_version text,
  ip_address text,
  created_at timestamptz not null default now()
);
create index if not exists idx_heartbeats_device_created on heartbeats (device_id, created_at);

create table if not exists device_commands (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references devices (id) on delete cascade,
  user_id text not null references "user" ("id") on delete cascade,
  command_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  result jsonb,
  issued_at timestamptz not null default now(),
  acked_at timestamptz,
  completed_at timestamptz
);
create index if not exists idx_device_commands_device_status on device_commands (device_id, status, issued_at);
