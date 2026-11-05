/**
 * Owner-scoped tables exposed by /api/data/*. Every query is filtered by the
 * signed-in user's id, which replaces the row-level security Supabase had.
 * Only columns listed here can be written or filtered on.
 */

export interface Resource {
  table: string;
  /** Columns the client may set on insert/update (user_id is always forced). */
  writable: string[];
  /** Writable columns stored as jsonb (serialized explicitly so arrays stay JSON). */
  json?: string[];
  /** Columns allowed as `?col=value` equality filters. */
  filters: string[];
  /** Default ORDER BY. */
  order: string;
  /** Extra select expressions, evaluated against alias `t`. */
  extraSelect?: string;
  /** Writable/filterable columns that point at other owner-scoped tables. */
  refs?: Record<string, string>;
  /** Rows are created server-side only (e.g. by the fleet control plane). */
  noCreate?: boolean;
  /** Columns never returned to the browser (e.g. secret hashes). */
  hidden?: string[];
}

export const resources: Record<string, Resource> = {
  devices: {
    table: "devices",
    writable: [
      "name", "device_type", "status", "hardware_specs", "tags", "config_overrides",
      "metadata", "firmware_version", "ip_address", "server_url", "registered_at",
    ],
    json: ["hardware_specs", "tags", "config_overrides", "metadata"],
    filters: ["status", "device_type"],
    order: "created_at desc",
    hidden: ["api_key_hash"],
  },
  device_resource_history: {
    table: "device_resource_history",
    writable: ["device_id", "resource_usage"],
    json: ["resource_usage"],
    filters: ["device_id"],
    order: "created_at desc",
    refs: { device_id: "devices" },
  },
  device_commands: {
    table: "device_commands",
    writable: ["device_id", "command_type", "payload"],
    json: ["payload"],
    filters: ["device_id", "status"],
    order: "issued_at desc",
    refs: { device_id: "devices" },
  },
  deployments: {
    table: "deployments",
    writable: [
      "name", "model_id", "model_version", "model_url", "model_checksum", "strategy", "status",
      "rollout_stages", "current_stage", "target_device_ids", "target_group_id",
      "bandwidth_limit_mbps", "rollback_version", "started_at", "completed_at",
    ],
    json: ["rollout_stages", "target_device_ids"],
    filters: ["status"],
    order: "created_at desc",
    refs: { target_group_id: "device_groups" },
  },
  deployment_device_status: {
    table: "deployment_device_status",
    writable: [
      "deployment_id", "device_id", "status", "stage", "progress", "error_message",
      "started_at", "completed_at",
    ],
    filters: ["deployment_id", "device_id"],
    order: "created_at asc",
    refs: { deployment_id: "deployments", device_id: "devices" },
  },
  device_groups: {
    table: "device_groups",
    writable: ["name", "description", "tag_filter", "auto_scaling_policy"],
    json: ["tag_filter", "auto_scaling_policy"],
    filters: [],
    order: "created_at desc",
    extraSelect: "(select count(*) from group_members m where m.group_id = t.id)::int as device_count",
  },
  group_members: {
    table: "group_members",
    writable: ["group_id", "device_id"],
    filters: ["group_id", "device_id"],
    order: "created_at asc",
    refs: { group_id: "device_groups", device_id: "devices" },
  },
  maintenance_windows: {
    table: "maintenance_windows",
    writable: ["name", "description", "device_ids", "group_id", "starts_at", "ends_at", "recurrence", "is_active"],
    json: ["device_ids"],
    filters: ["is_active"],
    order: "starts_at desc",
    refs: { group_id: "device_groups" },
  },
  fleet_alerts: {
    table: "fleet_alerts",
    writable: ["resolved", "resolved_at"],
    filters: ["resolved", "severity", "device_id"],
    order: "created_at desc",
    noCreate: true,
  },
  inference_history: {
    table: "inference_history",
    writable: [
      "model", "task", "timestamp", "image_width", "image_height", "image_source",
      "object_count", "objects_json", "inference_ms", "thumbnail_url",
    ],
    filters: [],
    order: "created_at desc",
  },
  observation_memory: {
    table: "observation_memory",
    writable: [
      "tick", "timestamp", "detections_json", "scene_summary", "change_description",
      "significance", "tags", "session_id",
    ],
    json: ["detections_json"],
    filters: ["session_id"],
    order: "timestamp desc",
  },
  api_keys: {
    table: "api_keys",
    writable: ["name", "key_prefix", "key_hash"],
    filters: [],
    order: "created_at desc",
    hidden: ["key_hash"],
  },
};
