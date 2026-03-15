# Fleet Management (131–145)

---

## 131. Device Registry & Enrollment

**As an enterprise ops team member, I can register edge devices running OpenEye into a central fleet registry with auto-enrollment via provisioning tokens.**

### Acceptance Criteria

- [ ] `openeye fleet register --name "warehouse-cam-01" --site warehouse-east --tags gpu:jetson,location:entrance` registers a device in the central fleet registry and returns a unique `device_id` (UUID)
- [ ] `openeye fleet enroll --token <provisioning-token>` on an edge device auto-registers it using a pre-generated provisioning token, pulling its assigned name, site, tags, and initial configuration from the server
- [ ] `openeye fleet create-token --site warehouse-east --expires 24h --max-uses 50` generates a provisioning token scoped to a site with configurable expiry and usage limits
- [ ] Device enrollment collects hardware fingerprint: CPU model, GPU type, RAM, disk, OS version, MAC address, and OpenEye CLI version — stored in the registry as `device.hardware_profile`
- [ ] `GET /api/v1/fleet/devices` returns a paginated list of all registered devices with filtering by `site`, `status`, `tags`, and `model`
- [ ] `GET /api/v1/fleet/devices/{device_id}` returns full device details including hardware profile, assigned configuration, enrollment timestamp, and last heartbeat
- [ ] `DELETE /api/v1/fleet/devices/{device_id}` deregisters a device, revoking its credentials and removing it from all groups
- [ ] Each enrolled device receives a unique mTLS client certificate (or API key) stored at `~/.openeye/device-credentials/` for authenticating all fleet communication
- [ ] Device registry data is stored in the fleet database with schema defined in `backend/src/fleet/models/device.py` using SQLAlchemy
- [ ] `openeye fleet list` shows all registered devices in a table format: `device_id`, `name`, `site`, `status`, `last_seen`, `model`, `uptime`
- [ ] Enrollment triggers a `device.enrolled` event on the MQTT topic `openeye/fleet/events` for integration with external monitoring systems
- [ ] Registry API supports bulk registration via `POST /api/v1/fleet/devices/bulk` with a CSV or JSON array of device definitions
- [ ] `openeye fleet export --format csv > devices.csv` exports the full device registry for auditing

### Edge Cases

- [ ] Duplicate enrollment: if a device with the same hardware fingerprint (MAC address) is already registered, the enrollment returns a `409 Conflict` with the existing `device_id` — does not create a duplicate entry
- [ ] Expired provisioning token: enrollment fails with `401 Unauthorized` and a message: "Provisioning token expired at <timestamp>. Generate a new token with `openeye fleet create-token`"
- [ ] Token usage limit exceeded: enrollment fails with `403 Forbidden` and a message: "Token has reached its maximum usage count (<N>). Generate a new token"
- [ ] Network unreachable during enrollment: the CLI retries with exponential backoff (1s, 2s, 4s, ... up to 60s) for `--enroll-timeout` (default: 120s). If enrollment fails, exits with a clear message and the device remains unenrolled
- [ ] Device re-enrollment after deregistration: allowed by default — the device gets a new `device_id` and fresh credentials. The old `device_id` is marked as `deregistered` in the audit log and is never reused
- [ ] Certificate rotation: device certificates expire after `--cert-ttl` (default: 365 days). The device agent auto-renews 30 days before expiry via `POST /api/v1/fleet/devices/{device_id}/renew`
- [ ] Bulk registration with malformed CSV: valid rows are processed, invalid rows are returned in the response body with line numbers and error details — partial success is supported
- [ ] Enrollment from behind a NAT/firewall: the device initiates an outbound HTTPS connection to the fleet server — no inbound ports required. Connection uses WebSocket upgrade for persistent communication
- [ ] Concurrent enrollment of 100+ devices simultaneously (e.g., factory provisioning): the server handles concurrent token validation with database-level locking to prevent token over-use
- [ ] Hardware fingerprint changes (e.g., NIC replacement): the device re-enrolls with the updated fingerprint. If `--strict-fingerprint` is enabled, the enrollment is rejected and requires admin approval via `openeye fleet approve --device <device_id>`
- [ ] Provisioning token replay attack: a stolen token (within expiry/usage limits) used to enroll rogue devices — no token binding to network range or device pre-approval
- [ ] mTLS certificate storage on unencrypted SD card: credentials at `~/.openeye/device-credentials/` could be cloned if SD card is physically extracted — no TPM-backed key storage or encrypted credential storage
- [ ] Partial credential write on power loss: device loses power after enrollment succeeds server-side but before credentials are fully written to disk — device is registered but has no local credentials
- [ ] Enrollment behind HTTP proxy: only NAT/firewall is mentioned — corporate HTTP/HTTPS proxy with authentication (NTLM, Kerberos) not addressed

### Technical Notes

- Fleet registry API lives in `backend/src/fleet/routes/devices.py` with Pydantic request/response models in `backend/src/fleet/schemas/device.py`
- Device model in `backend/src/fleet/models/device.py` uses SQLAlchemy with fields: `id`, `name`, `site`, `tags`, `hardware_profile` (JSON), `status`, `enrolled_at`, `last_heartbeat`, `config_version`, `credentials_hash`
- Provisioning tokens are JWTs signed with the fleet server's private key, containing `site`, `expires_at`, `max_uses`, `created_by`
- Device-to-cloud communication uses MQTT over TLS (port 8883) with the device's mTLS certificate for authentication
- The `openeye fleet` CLI subcommand group is registered in `cli/openeye_ai/cli.py` under the `fleet` command group

---

## 132. Fleet Dashboard

**As an enterprise ops team member, I get a real-time web dashboard showing all registered devices, their status, models running, inference throughput, and health.**

### Acceptance Criteria

- [ ] The fleet dashboard is served at `https://<fleet-server>/dashboard/fleet` and is accessible via `openeye fleet dashboard --open` which launches the URL in the default browser
- [ ] Dashboard displays a device map view showing device locations (if GPS or site coordinates are configured) with color-coded status indicators: green (healthy), yellow (degraded), red (offline), grey (decommissioned)
- [ ] Dashboard displays a device table view with sortable columns: `Name`, `Site`, `Status`, `Model`, `FPS`, `CPU %`, `GPU %`, `Memory %`, `Temp`, `Uptime`, `Last Seen`, `Version`
- [ ] Real-time updates are pushed via WebSocket from `wss://<fleet-server>/ws/fleet/dashboard` — no manual refresh required
- [ ] Device detail panel (click a device) shows: live inference preview (last frame + detections), 24-hour metric graphs (FPS, CPU, GPU, memory, temperature), active alerts, configuration diff from fleet default, and recent log tail
- [ ] Fleet-wide summary cards at the top show: total devices, online count, offline count, degraded count, total fleet FPS, average model latency, active alerts count
- [ ] Filtering and search: filter by site, tag, status, model, or free-text search across device names — URL query params update for bookmarkable filtered views
- [ ] Dashboard supports dark mode toggle and responsive layout for tablet/mobile viewing
- [ ] `GET /api/v1/fleet/dashboard/summary` returns the aggregated fleet metrics as JSON for programmatic consumption
- [ ] `GET /api/v1/fleet/dashboard/devices/{device_id}/metrics?range=24h&resolution=1m` returns time-series metric data for a specific device
- [ ] Dashboard includes a fleet health score (0-100) computed from: percentage of online devices, average FPS vs target, error rate, and thermal status
- [ ] Role-based access: `viewer` can see dashboard, `operator` can trigger actions (restart, push config), `admin` can deregister devices — roles are enforced via JWT claims

### Edge Cases

- [ ] Device goes offline mid-session: the dashboard updates the device status to red within the heartbeat timeout window (`--heartbeat-interval`, default: 30s, timeout: 3x interval = 90s) — does not require a page refresh
- [ ] WebSocket connection drops (network blip): the dashboard auto-reconnects with exponential backoff and displays a "Reconnecting..." banner — does not show stale data without indicating staleness
- [ ] Fleet with 1,000+ devices: the device table uses virtual scrolling (renders only visible rows). API responses are paginated with `?page=1&per_page=50`. Map view clusters nearby devices to avoid rendering thousands of markers
- [ ] Dashboard loaded with no devices registered: shows an empty state with a "Get Started" guide linking to the enrollment documentation and a `openeye fleet register` command example
- [ ] Metric data gaps (device was offline for 2 hours): graphs render gaps as dashed lines or grey regions — no interpolation over missing data. Tooltip shows "No data available" for gap periods
- [ ] Multiple dashboards open simultaneously (different operators): each WebSocket connection is independent. Server tracks connections via `connection_id` and broadcasts updates to all active sessions
- [ ] Browser tab goes to sleep (background tab throttling): on tab re-focus, the dashboard fetches the latest state via REST API to catch up, then resumes WebSocket streaming
- [ ] Slow dashboard API response (>3s): the UI shows a loading skeleton and logs a client-side performance warning. If the API does not respond within 10s, displays an error with a retry button
- [ ] Metric resolution mismatch: requesting `1m` resolution for a `30d` range would return too many data points — the API auto-adjusts resolution to `1h` for ranges >7d and `1d` for ranges >90d, returning the actual resolution in the response
- [ ] Dashboard XSS via device names or tags: a malicious device name like `<script>alert(1)</script>` injected via enrollment could execute in the dashboard — sanitize all user input on display
- [ ] RBAC bypass via direct API calls: `viewer` role restriction enforced via JWT claims — server-side enforcement on mutation endpoints must also be validated

### Technical Notes

- Dashboard frontend is a React SPA served from `src/pages/dashboard/Fleet.tsx` with components in `src/components/dashboard/fleet/`
- Device map uses Leaflet.js (or Mapbox GL) with tile layers — coordinates are stored per-site in the fleet config
- Time-series metrics are stored in a time-series database (TimescaleDB extension on PostgreSQL, or InfluxDB) with configurable retention (`--metrics-retention`, default: 30 days)
- WebSocket handler at `backend/src/fleet/ws/dashboard.py` broadcasts device state changes and metric updates
- Fleet health score formula: `(online_pct * 0.4) + (fps_health * 0.3) + ((1 - error_rate) * 0.2) + (thermal_health * 0.1)` where each component is normalized to 0-1
- References device registry from story 131 and health monitoring from story 136

---

## 133. Remote Configuration Management

**As an enterprise ops team member, I can push configuration updates (model changes, thresholds, zones, schedules) to devices remotely.**

### Acceptance Criteria

- [ ] `openeye fleet push-config --device warehouse-cam-01 --config config.yaml` pushes a configuration update to a specific device
- [ ] `openeye fleet push-config --site warehouse-east --config config.yaml` pushes a configuration update to all devices at a site
- [ ] `openeye fleet push-config --tag gpu:jetson --config config.yaml` pushes to all devices matching a tag filter
- [ ] Configuration files support all OpenEye runtime settings: `model`, `confidence_threshold`, `detection_zones`, `schedule`, `output_sinks`, `fps_target`, `resolution`, `preprocessing`, `postprocessing`
- [ ] `POST /api/v1/fleet/config/push` API endpoint accepts a device selector (device ID, site, or tag query) and a configuration payload
- [ ] Configuration is versioned: each push increments the device's `config_version` counter. Previous versions are retained for rollback via `openeye fleet rollback-config --device <id> --version <n>`
- [ ] Devices receive config updates via MQTT topic `openeye/devices/{device_id}/config` and apply them within 5 seconds of receipt
- [ ] Config validation: the fleet server validates the configuration against a JSON schema before pushing — invalid configs are rejected with detailed validation errors
- [ ] Dry-run mode: `openeye fleet push-config --dry-run --site warehouse-east --config config.yaml` shows which devices would receive the update and what fields would change, without applying
- [ ] Config diff: `openeye fleet config-diff --device warehouse-cam-01 --config config.yaml` shows a unified diff between the device's current config and the proposed config
- [ ] Scheduled config changes: `openeye fleet push-config --schedule "2026-03-20T02:00:00Z" --site warehouse-east --config night-mode.yaml` applies the config at the specified time
- [ ] Config inheritance: devices inherit a site-level default config, which inherits from a fleet-level default. Device-specific overrides take precedence: `fleet-default → site-default → device-specific`
- [ ] `openeye fleet get-config --device warehouse-cam-01` retrieves the currently active configuration for a device, showing the merged result with inheritance sources annotated

### Edge Cases

- [ ] Device is offline when config is pushed: the config update is queued on the MQTT broker with QoS 1 (at-least-once delivery). When the device reconnects, it receives and applies the pending config. Queue retention is configurable (`--config-queue-ttl`, default: 7 days)
- [ ] Config push to 500 devices simultaneously: the server batches MQTT publishes in groups of 50 with a 100ms delay between batches to avoid broker overload. Progress is reported via `openeye fleet push-config --progress`
- [ ] Config applies partially (e.g., model change succeeds but zone config is malformed): the device rejects the entire config atomically and reports the error. The device remains on its previous config. Error is surfaced via `device.config_rejected` event
- [ ] Config rollback to a version that references a model not present on the device: the rollback is rejected with an error listing the missing model and suggesting `openeye fleet push-model` (story 134) first
- [ ] Config version conflict: if two operators push config to the same device simultaneously, the server uses optimistic locking (config version as ETag). The second push fails with `409 Conflict` and a message showing the conflicting change
- [ ] Scheduled config change for a device that gets decommissioned before the schedule fires: the scheduled change is cancelled and logged. No config is pushed to a decommissioned device
- [ ] Config YAML includes environment variable references (`${SITE_API_KEY}`): variables are resolved on the fleet server side from the device's assigned secrets (story 199). Unresolved variables fail validation with a list of missing variables
- [ ] Device running an older OpenEye version that does not support a new config field (e.g., `preprocessing.denoise`): the device ignores unknown fields with a warning log and applies the rest. The fleet dashboard shows a `config_partial_apply` status
- [ ] Network partition during config application: the device applies configs idempotently. If the same config message is delivered twice (MQTT QoS 1 redelivery), the second application is a no-op
- [ ] Config inheritance override removal: setting a field to `null` in a device config removes the override and falls back to the site/fleet default. Setting to an explicit value overrides the parent
- [ ] MQTT broker crash during config delivery: QoS 1 requires broker persistence — if broker restarts and loses persistent store, queued configs are lost
- [ ] Config YAML bomb (deeply nested or massive file): no maximum config file size or YAML parsing depth limit — prevent DoS on fleet server or edge device
- [ ] Secrets leak in config diff output: `openeye fleet config-diff` might display resolved `${SITE_API_KEY}` values in plaintext — redact secrets in diff output
- [ ] Config push during network partition with split-brain: two HA fleet servers independently accept different config for same device — no fleet server config push coordination

### Technical Notes

- Config push uses MQTT with QoS 1 for reliable delivery. Topic structure: `openeye/devices/{device_id}/config` for device-specific, `openeye/sites/{site_id}/config` for site-wide broadcasts
- Config versions are stored in `backend/src/fleet/models/config_version.py` with full config snapshots (not diffs) for reliable rollback
- Config schema validation uses JSON Schema stored at `backend/src/fleet/schemas/device_config_schema.json`
- Device-side config handler lives in `cli/openeye_ai/fleet/config_agent.py` — watches the MQTT topic and hot-reloads the running OpenEye process via `SIGHUP`
- References device registry (story 131) for device/site/tag selectors and fleet grouping (story 137) for tag-based targeting

---

## 134. OTA Model Updates

**As an enterprise ops team member, I can deploy new model versions to edge devices with staged rollouts and automatic rollback on failure.**

### Acceptance Criteria

- [ ] `openeye fleet push-model --model yolov8:v2.1 --target site:warehouse-east` deploys a new model version to all devices at the specified site
- [ ] `openeye fleet push-model --model yolov8:v2.1 --target tag:gpu:jetson --rollout canary:10%` deploys to 10% of matching devices first, then proceeds after health validation (story 141)
- [ ] Model packages are stored in the fleet model registry at `GET /api/v1/fleet/models` with metadata: name, version, size, compatible hardware, minimum OpenEye version, checksum (SHA-256)
- [ ] `openeye fleet publish-model --model ./yolov8-custom.pt --name yolov8-custom --version 1.0` uploads a model to the fleet registry
- [ ] Delta updates: if the device already has a previous version of the model, only the binary diff is transferred (using `bsdiff` or `zstd` dictionary compression), reducing bandwidth by 60-80%
- [ ] Each device downloads the model package from the fleet server via HTTPS, verifies the SHA-256 checksum, and swaps the active model atomically
- [ ] Model swap is zero-downtime: the new model is loaded into memory alongside the old model, inference switches to the new model, and the old model is unloaded — no frames are dropped during the swap
- [ ] Automatic rollback: if the new model's inference error rate exceeds `--rollback-threshold` (default: 5%) or FPS drops below `--min-fps` (default: 50% of previous) within `--validation-window` (default: 5 minutes), the device automatically reverts to the previous model version
- [ ] `openeye fleet model-status --target site:warehouse-east` shows rollout progress: devices pending, downloading, validating, active, rolled back
- [ ] Model deployment history is tracked per-device: `openeye fleet model-history --device warehouse-cam-01` shows all model versions deployed with timestamps, who deployed them, and status
- [ ] `POST /api/v1/fleet/models/{model_id}/deploy` API endpoint triggers a deployment with rollout policy, target selector, and validation criteria
- [ ] Model packages support TensorRT engine files with hardware-specific variants: the fleet server selects the correct variant based on the device's `hardware_profile.gpu` from the registry (story 131)

### Edge Cases

- [ ] Device runs out of disk space during model download: the download is aborted, temporary files are cleaned up, and the device reports `disk_space_insufficient` with the required and available space. Current model continues running unaffected
- [ ] Network interruption during model download: download supports resume via HTTP Range headers. Partial downloads are retained for `--download-resume-ttl` (default: 24h) before cleanup
- [ ] Checksum mismatch after download: the corrupted file is deleted, the error is reported to the fleet server, and the download is retried up to 3 times. If all retries fail, the device remains on the current model and the deployment is marked `failed` for that device
- [ ] Model requires a newer OpenEye version than installed on the device: the deployment is rejected pre-download with an error: "Model yolov8:v2.1 requires OpenEye >= 0.5.0, device has 0.4.2. Push a software update first (story 135)"
- [ ] Automatic rollback triggers during a canary rollout: the rollout is halted, the canary devices revert, and the remaining fleet is not updated. The deployment status shows `canary_failed` with the failure reason
- [ ] Model file is valid but produces nonsensical outputs (e.g., all zeros): the validation window catches this via the error rate threshold. If `--validation-check inference-quality` is enabled, a set of reference images is run through the new model and outputs are compared to expected baselines
- [ ] Two model deployments are triggered simultaneously for the same device: the server queues deployments and processes them sequentially. The second deployment starts only after the first completes or fails
- [ ] TensorRT engine built for a different GPU architecture (e.g., pushing an sm87 engine to an sm72 device): the fleet server checks `hardware_profile.gpu.compute_capability` before deploying. Mismatched engines are rejected with a message suggesting a rebuild
- [ ] Model is larger than the device's available GPU memory: the deployment proceeds (model is downloaded) but fails at load time. The device reports `gpu_memory_insufficient` and reverts to the previous model. Fleet dashboard surfaces this as a deployment failure with the memory details
- [ ] Delta update base version mismatch: if the device's current model version does not match the delta's expected base, the full model is downloaded instead. A warning is logged about the unexpected base version
- [ ] Power loss during atomic model swap: symlink strategy can fail between unlink and create — need atomic swap via `rename(2)` on temp symlink
- [ ] Model file corruption on disk after successful checksum (bit rot/SD card wear): checksum verified at download but model could corrupt on disk — no periodic integrity check
- [ ] Zero-downtime swap requires both models loaded simultaneously: insufficient memory for two models not addressed as transient state
- [ ] Canary percentage rounds to 0 devices: 10% of 5 devices = 0.5 — no minimum canary count (at least 1)
- [ ] Rollback threshold met by transient startup noise: new model briefly shows high error rate during warmup — no warmup grace period before validation

### Technical Notes

- Model registry is stored in `backend/src/fleet/models/model_registry.py` with model binaries in object storage (S3/GCS/MinIO) referenced by URL
- Delta updates use `bsdiff4` Python library for generating and applying binary patches
- Model deployment orchestration lives in `backend/src/fleet/services/model_deployer.py` with rollout state machine: `pending → downloading → validating → active | rolled_back | failed`
- Device-side model agent at `cli/openeye_ai/fleet/model_agent.py` handles download, verification, swap, and validation
- Zero-downtime swap uses a symlink strategy: `~/.openeye/models/active/yolov8 → yolov8-v2.1/` — the inference process watches the symlink for changes
- References fleet rollout policies (story 141) for canary/blue-green deployment strategies and device health monitoring (story 136) for validation metrics

---

## 135. OTA Software Updates

**As an enterprise ops team member, I can push OpenEye software updates to edge devices with delta updates and rollback.**

### Acceptance Criteria

- [ ] `openeye fleet push-update --version 0.5.0 --target site:warehouse-east` deploys a new OpenEye CLI version to all devices at the specified site
- [ ] `openeye fleet push-update --version 0.5.0 --target all --rollout canary:5%` deploys to 5% of the fleet first with automatic promotion after validation (story 141)
- [ ] Software packages are published to the fleet update server: `openeye fleet publish-release --package dist/openeye-0.5.0-linux-aarch64.tar.gz --version 0.5.0 --platform linux/aarch64`
- [ ] Delta updates: binary diffs between versions are pre-computed on the server. Devices download only the diff (typically 10-30% of full package size)
- [ ] Update process: download package → verify checksum → stop inference gracefully → install update → run self-test → start inference → report success. If any step fails, rollback to previous version
- [ ] Self-test after update: `openeye self-test` runs a validation suite (load model, run inference on a test image, verify output schema, check all adapters) — must pass within 30 seconds
- [ ] Rollback: if the self-test fails or the device reports errors within `--validation-window` (default: 10 minutes), the update agent reverts to the previous version automatically
- [ ] Update is zero-downtime on devices with sufficient disk space: the new version is installed alongside the old version, inference is migrated, and the old version is cleaned up after validation
- [ ] `openeye fleet update-status --target site:warehouse-east` shows rollout progress: devices pending, downloading, installing, validating, active, rolled back
- [ ] `GET /api/v1/fleet/updates` lists available software releases with changelogs, platform compatibility, and minimum system requirements
- [ ] `GET /api/v1/fleet/updates/{version}/compatibility?device_id=<id>` checks if a specific device is compatible with a release based on OS, architecture, and dependencies
- [ ] Update scheduling: `openeye fleet push-update --schedule "2026-03-20T03:00:00Z" --target all` schedules the update during a maintenance window
- [ ] Devices report their current version to the fleet server on every heartbeat — the fleet dashboard shows version distribution across the fleet

### Edge Cases

- [ ] Device loses power during update installation: on next boot, the update agent detects the incomplete installation (via a `update-in-progress` lockfile at `~/.openeye/.update-lock`), rolls back to the previous version, and reports `update_interrupted` to the fleet server
- [ ] Disk space insufficient for side-by-side installation: the update falls back to in-place update mode, which is riskier (no automatic rollback if install corrupts files). The device logs a warning and the fleet dashboard shows `update_mode: in-place`
- [ ] New version has a dependency conflict (e.g., requires Python 3.11 but device has 3.10): the compatibility check (pre-download) catches this and rejects the update with: "OpenEye 0.5.0 requires Python >= 3.11. Device has Python 3.10.12"
- [ ] Self-test passes but inference fails 30 minutes later (delayed regression): the `--validation-window` catches this only if set long enough. For critical deployments, `--validation-window 60m` is recommended. The device reverts and reports `late_regression`
- [ ] Update agent itself is buggy (the update mechanism needs updating): a minimal "bootstrap updater" at `~/.openeye/bin/openeye-updater` is separate from the main OpenEye binary and is updated independently via `openeye fleet push-updater`
- [ ] Multiple updates queued (e.g., 0.4.0 → 0.5.0 → 0.5.1): the device skips intermediate versions and applies only the latest target version. Delta updates are computed from the device's current version to the target version
- [ ] Rollback of a rollback: if the previous version also has issues (e.g., the device was already degraded before the update), the update agent does not enter a rollback loop. After one rollback, further issues are reported as `device_degraded` without attempting another rollback
- [ ] Update during active inference with a connected client (e.g., Solo CLI via story 84): the inference pipeline is drained (current frame completes), clients receive a `SERVICE_RESTARTING` notification, and inference resumes on the new version. Total downtime target: <5 seconds
- [ ] Staged rollout with heterogeneous fleet (mix of ARM64 and x86 devices): the server selects the correct platform-specific package for each device based on `hardware_profile.arch` from the registry (story 131)
- [ ] Concurrent update and config push: if a config push (story 133) arrives while an update is in progress, the config is queued and applied after the update completes. The queue is persisted to survive the restart
- [ ] Update package signing and verification: checksum verification mentioned but not cryptographic signing — MITM or compromised CDN could serve malicious update with valid checksum
- [ ] Read-only filesystem: some embedded devices mount root as read-only — update mechanism assumes writable filesystem
- [ ] Update agent itself crashes during update: bootstrap updater mentioned but no hardware watchdog timer or recovery partition if bootstrap has a bug

### Technical Notes

- Software update packages are stored in object storage with platform-specific directories: `releases/0.5.0/linux-aarch64/`, `releases/0.5.0/linux-x86_64/`
- Delta updates use `bsdiff4` for binary diffing. Pre-computed diffs are stored as `releases/0.5.0/deltas/from-0.4.2-linux-aarch64.patch`
- Update agent runs as a separate process: `cli/openeye_ai/fleet/update_agent.py` — it is not part of the main OpenEye process to survive restarts
- Self-test suite at `cli/openeye_ai/fleet/self_test.py` runs: model load, single inference, schema validation, adapter health checks, MQTT connectivity test
- Side-by-side installation uses `~/.openeye/versions/0.5.0/` alongside `~/.openeye/versions/0.4.2/` with a `current` symlink
- References fleet rollout policies (story 141), device health monitoring (story 136), and device registry (story 131) for targeting

---

## 136. Device Health Monitoring

**As an enterprise ops team member, I get continuous health metrics from each device (CPU, GPU, memory, temp, disk, inference FPS, error rates).**

### Acceptance Criteria

- [ ] Each enrolled device runs a health agent that publishes metrics to the fleet server every `--health-interval` (default: 15 seconds) via MQTT topic `openeye/devices/{device_id}/health`
- [ ] Metrics collected: `cpu_percent`, `gpu_percent`, `gpu_memory_percent`, `ram_percent`, `disk_percent`, `cpu_temp_c`, `gpu_temp_c`, `inference_fps`, `inference_latency_ms` (p50, p95, p99), `error_rate`, `frames_processed`, `frames_dropped`, `uptime_seconds`, `network_bytes_in`, `network_bytes_out`
- [ ] `openeye device status` on an edge device prints a live dashboard of all local health metrics with color-coded thresholds (green/yellow/red)
- [ ] `openeye device status --device warehouse-cam-01` from a fleet management workstation retrieves and displays the health metrics for a remote device
- [ ] `GET /api/v1/fleet/devices/{device_id}/health` returns the latest health snapshot as JSON
- [ ] `GET /api/v1/fleet/devices/{device_id}/health/history?range=24h&metric=inference_fps` returns time-series data for a specific metric
- [ ] Health metrics are stored in a time-series database with configurable retention: `--metrics-retention 30d` (default)
- [ ] Aggregate fleet metrics: `GET /api/v1/fleet/health/aggregate?group_by=site` returns averages, min, max, and percentiles across device groups
- [ ] Health thresholds are configurable per-device or per-site via the config system (story 133): `health.thresholds.cpu_percent.warning: 80`, `health.thresholds.cpu_percent.critical: 95`
- [ ] When a metric crosses a threshold, the health agent publishes a `device.health.warning` or `device.health.critical` event to `openeye/fleet/alerts` (consumed by story 145)
- [ ] NVIDIA GPU metrics are collected via `nvidia-smi` or `pynvml`. Jetson metrics use `jtop` (jetson-stats). CPU-only devices report GPU fields as `null`
- [ ] `openeye device health-report --output report.json` generates a comprehensive health report suitable for SLA compliance auditing
- [ ] Health agent runs as a background thread within the main OpenEye process — no separate daemon required

### Edge Cases

- [ ] GPU monitoring library not available (e.g., `pynvml` not installed on a CPU-only device): GPU metrics are reported as `null` with a `gpu_monitoring: unavailable` field — does not crash or log errors repeatedly
- [ ] Metric collection takes longer than the health interval (e.g., `nvidia-smi` hangs): the health agent uses a timeout (default: 5s per metric source). If a source times out, stale values are reported with a `stale: true` flag and the timeout is logged
- [ ] Disk is 100% full: the health agent can still publish metrics (MQTT messages are small, ~1KB). However, if the time-series database on the server is full, metrics are dropped with a `storage_full` error and the fleet dashboard shows a warning
- [ ] Rapid metric spikes (e.g., CPU jumps to 100% for 1 second): short spikes are captured at the configured interval. For sub-second monitoring, `--health-interval 1` is supported but increases MQTT traffic by 15x — a warning is logged if interval < 5s
- [ ] Device clock skew: health metric timestamps use the device's local clock. If the fleet server detects >30s skew between the metric timestamp and receipt time, a `clock_skew` warning is attached to the device status
- [ ] Inference FPS drops to 0 (model crash, camera disconnect): the health agent continues reporting metrics. `inference_fps: 0` with `inference_status: stopped` is published. This is distinct from `inference_fps: null` (inference not configured)
- [ ] Temperature sensors not available (e.g., VM or container without hardware passthrough): temperature metrics are reported as `null` with `temp_monitoring: unavailable` — no error
- [ ] Network interface metrics on multi-NIC devices: by default, all interfaces are summed. `--health-nic eth0` monitors a specific interface. If the specified NIC does not exist, falls back to all NICs with a warning
- [ ] Health agent consumes too much CPU on resource-constrained devices: the agent targets <1% CPU overhead. If the device has fewer than 2 CPU cores, the health interval is automatically raised to 30s with a warning
- [ ] MQTT broker is unreachable: metrics are buffered in a local ring buffer (default: 1000 entries, ~1MB). When the connection is restored, buffered metrics are published in chronological order. If the buffer fills, oldest metrics are evicted
- [ ] Health agent thread starvation under heavy inference load: agent runs as background thread — under heavy GPU/CPU inference, health thread may be starved and miss reporting interval
- [ ] Metric payload tampering (MQTT message injection): attacker with MQTT access could inject false health metrics — no metric payload signing
- [ ] pynvml/jtop library crash (segfault): native library segfault kills entire OpenEye process since health agent is a thread — no process isolation

### Technical Notes

- Health agent at `cli/openeye_ai/fleet/health_agent.py` collects metrics using `psutil` (CPU, RAM, disk, network), `pynvml` (NVIDIA GPU), and `jtop` (Jetson)
- MQTT topic structure: `openeye/devices/{device_id}/health` for periodic metrics, `openeye/fleet/alerts` for threshold crossings
- Time-series storage uses TimescaleDB (PostgreSQL extension) with hypertable partitioning on `timestamp` and indexing on `device_id`
- Metric payload is a compact JSON: `{"ts": 1742054400, "cpu": 45.2, "gpu": 72.1, "ram": 68.3, "disk": 42.0, "temp_cpu": 62, "temp_gpu": 71, "fps": 28.4, "lat_p50": 33, "lat_p95": 41, "lat_p99": 55, "err_rate": 0.001, "frames": 102400, "dropped": 12, "uptime": 86400}`
- References fleet dashboard (story 132) for metric visualization and fleet alerting (story 145) for threshold-based alerts

---

## 137. Fleet Grouping & Tagging

**As an enterprise ops team member, I can organize devices into groups (by site, function, customer) with tag-based filtering and bulk operations.**

### Acceptance Criteria

- [ ] `openeye fleet group create --name "warehouse-east-entrance" --parent site:warehouse-east` creates a device group with optional hierarchical nesting
- [ ] `openeye fleet group add --group warehouse-east-entrance --device warehouse-cam-01 warehouse-cam-02` adds devices to a group
- [ ] `openeye fleet tag --device warehouse-cam-01 --tags environment:production,model:yolov8,priority:high` assigns key-value tags to a device
- [ ] `openeye fleet tag --site warehouse-east --tags region:us-east,tier:enterprise` assigns tags at the site level — all devices in the site inherit these tags
- [ ] `openeye fleet list --filter "tag:environment=production AND tag:model=yolov8 AND status=online"` filters devices using a boolean query language
- [ ] `openeye fleet bulk --filter "tag:gpu=jetson" --action restart` performs bulk actions on filtered devices. Supported actions: `restart`, `push-config`, `push-model`, `push-update`, `decommission`
- [ ] `GET /api/v1/fleet/groups` returns the group hierarchy as a tree structure with device counts per group
- [ ] `GET /api/v1/fleet/devices?tags=environment:production,model:yolov8&status=online` filters devices via API query parameters
- [ ] Groups support metadata: `--description "Entrance cameras for warehouse east"` and `--contact ops-team@company.com` for ownership tracking
- [ ] `openeye fleet group list` shows all groups with device counts, and `openeye fleet group members --group warehouse-east-entrance` lists devices in a group
- [ ] Devices can belong to multiple groups simultaneously (groups are not mutually exclusive)
- [ ] Tag removal: `openeye fleet untag --device warehouse-cam-01 --tags priority` removes a specific tag key from a device
- [ ] Group-level policies: configurations pushed to a group apply to all current and future members (new devices added to the group automatically receive the group's config)

### Edge Cases

- [ ] Circular group hierarchy: `openeye fleet group create --parent A` where A is a child of the new group — the server rejects this with a `400 Bad Request` and message "Circular group hierarchy detected: <path>"
- [ ] Deleting a group with active devices: `openeye fleet group delete --group warehouse-east-entrance` removes the group association but does not deregister the devices. Devices remain registered and retain their tags. `--cascade` flag is required to also deregister all member devices
- [ ] Bulk operation on 1,000+ devices: the server processes bulk actions in parallel batches of 50 with progress reporting via SSE. `openeye fleet bulk --filter "tag:gpu=jetson" --action restart --progress` shows a live progress bar
- [ ] Tag key naming conflicts: tags are case-insensitive and normalized to lowercase. `GPU:Jetson` and `gpu:jetson` are treated as the same tag. Creating a tag with invalid characters (spaces, special chars except `-`, `_`, `:`) is rejected with a validation error
- [ ] Filter query syntax error: `openeye fleet list --filter "tag:env=prod XAND status=online"` returns a parse error with the unexpected token highlighted and a link to filter syntax documentation
- [ ] Device in multiple groups with conflicting group-level configs: the most recently assigned group's config takes precedence, with a warning logged about the conflict. `openeye fleet group priority --device warehouse-cam-01` shows the group precedence order
- [ ] Removing the last device from a group: the group persists as an empty group. `openeye fleet group prune` removes all empty groups (with `--dry-run` support)
- [ ] Bulk action failure on some devices (e.g., 3 of 50 fail to restart): the operation continues for remaining devices. Final report shows: `47 succeeded, 3 failed` with failure reasons per device
- [ ] Reserved tag keys: `status`, `device_id`, `site`, `enrolled_at` are reserved system tags and cannot be set by users — attempting to set them returns a `400 Bad Request` listing the reserved keys
- [ ] Tag value exceeding max length (128 characters): rejected with a validation error showing the max length
- [ ] Tag injection via API: tags with SQL/NoSQL-injectable values through the API — only CLI character validation mentioned, not API-level parameterized query enforcement
- [ ] Filter query denial of service: complex boolean query with many nested parentheses could consume excessive CPU/memory — no query complexity limits

### Technical Notes

- Groups are stored in `backend/src/fleet/models/group.py` with a self-referential `parent_id` foreign key for hierarchy (adjacency list model with a materialized path column for efficient subtree queries)
- Tags are stored in `backend/src/fleet/models/device_tag.py` as a key-value table with `device_id`, `key`, `value` columns and a composite unique index on `(device_id, key)`
- Filter query parser at `backend/src/fleet/services/filter_parser.py` supports: `tag:<key>=<value>`, `status=<value>`, `site=<value>`, `group=<value>`, boolean operators `AND`, `OR`, `NOT`, and parentheses for grouping
- Bulk operations are executed via a task queue (Celery or Redis Queue) to handle large-scale actions asynchronously. Progress is tracked in `backend/src/fleet/models/bulk_operation.py`
- References device registry (story 131) for device identifiers and remote configuration management (story 133) for group-level config inheritance

---

## 138. Remote Shell & Debug Access

**As an enterprise ops team member, I can open a secure remote debug session to a specific edge device for troubleshooting.**

### Acceptance Criteria

- [ ] `openeye fleet shell --device warehouse-cam-01` opens an interactive remote shell session to the specified edge device
- [ ] The remote shell is a restricted shell: only `openeye` subcommands, `cat`, `ls`, `tail`, `df`, `free`, `top`, `nvidia-smi`, `journalctl`, and `ping` are allowed — no arbitrary command execution by default
- [ ] `openeye fleet shell --device warehouse-cam-01 --unrestricted` opens a full shell (requires `admin` role) with audit logging of all commands
- [ ] Communication is tunneled through the fleet server via WebSocket: `wss://<fleet-server>/ws/fleet/shell/{device_id}` — no direct inbound connection to the device is required
- [ ] `openeye fleet logs --device warehouse-cam-01 --tail 100` retrieves the last 100 lines of the OpenEye log from the device without opening a full shell session
- [ ] `openeye fleet logs --device warehouse-cam-01 --follow` streams logs in real-time from the device via MQTT topic `openeye/devices/{device_id}/logs`
- [ ] `openeye fleet debug --device warehouse-cam-01 --capture-frame` captures and downloads the latest inference frame (image + detections overlay) from the device for visual debugging
- [ ] `openeye fleet debug --device warehouse-cam-01 --profile 30s` captures a 30-second performance profile (CPU, GPU, inference latency per frame) and downloads the report
- [ ] All remote shell sessions are logged in an audit trail: `GET /api/v1/fleet/audit/shell?device_id=<id>` returns session logs with operator, commands executed, timestamps, and duration
- [ ] Session timeout: remote shells auto-terminate after `--session-timeout` (default: 30 minutes) of inactivity
- [ ] Maximum concurrent sessions per device: 1 (to prevent conflicting operations). A second operator attempting to connect sees: "Device warehouse-cam-01 has an active debug session by <operator>. Use `--force` to terminate the existing session"
- [ ] `openeye fleet debug --device warehouse-cam-01 --diagnostics` runs a comprehensive diagnostic suite and returns a structured report: connectivity, model health, camera status, disk space, GPU status, config validation

### Edge Cases

- [ ] Device is offline: `openeye fleet shell --device warehouse-cam-01` returns "Device warehouse-cam-01 is offline (last seen: 2026-03-15T10:30:00Z). Cannot establish remote session" — does not hang or wait indefinitely
- [ ] WebSocket connection drops mid-session: the client detects the disconnection within 5 seconds (WebSocket ping/pong), displays "Connection lost. Reconnecting..." and attempts to resume the session. If the session is still active on the device, the operator reconnects to the same session
- [ ] Operator attempts to run a disallowed command in restricted mode (e.g., `rm -rf /`): the command is rejected with "Command not allowed in restricted mode. Use `--unrestricted` with admin privileges for full access" and the attempt is logged in the audit trail
- [ ] `--capture-frame` on a device with no active camera: returns an error "No active camera feed on device warehouse-cam-01. Check camera configuration" with the device's current config summary
- [ ] Shell session during a software update (story 135): the session displays a warning "Software update in progress. Shell access may be interrupted" but remains connected. If the update requires a restart, the session is terminated with a message and the operator is prompted to reconnect after the update
- [ ] High-latency connection (>500ms RTT): the shell remains functional but keypress echo is delayed. The CLI displays the current latency in the shell prompt: `warehouse-cam-01 [482ms] $`
- [ ] Audit log storage is full: new shell sessions are rejected with "Audit log storage is full. Contact your administrator" — security audit logging is mandatory and cannot be bypassed
- [ ] `--profile` during a model swap (story 134): the profile captures the swap event as an anomaly in the trace — useful for measuring swap downtime but may show misleading average latency
- [ ] Device with very limited memory (e.g., <512MB free): the debug agent on the device uses <20MB overhead. If memory is critically low, the agent reduces its footprint by disabling frame capture and profiling, and logs a warning
- [ ] Unicode/encoding issues in log output: logs are streamed as UTF-8. Invalid byte sequences are replaced with the Unicode replacement character and a warning is displayed once per session
- [ ] Shell escape from restricted mode: creative use of allowed commands (e.g., `tail -f /dev/random | cat > /etc/passwd`) — no shell environment hardening (rbash, seccomp filters)
- [ ] WebSocket relay terminal injection: if relay does not sanitize control characters, attacker injects terminal escape sequences to manipulate operator's terminal
- [ ] Debug frame capture contains PII: captured inference frames may contain faces or license plates — no privacy redaction options

### Technical Notes

- Remote shell uses a WebSocket relay architecture: `operator CLI → fleet server WebSocket → MQTT command channel → device agent → PTY → MQTT response channel → fleet server → operator CLI`
- Device-side shell agent at `cli/openeye_ai/fleet/shell_agent.py` spawns a PTY (pseudo-terminal) for the restricted or unrestricted shell
- Restricted shell allowlist is configured in `cli/openeye_ai/fleet/shell_allowlist.yaml` and can be customized per-fleet via the config system (story 133)
- Audit trail is stored in `backend/src/fleet/models/audit_log.py` with fields: `session_id`, `device_id`, `operator_id`, `command`, `output_hash`, `timestamp`, `duration`
- Frame capture uses the existing inference pipeline's last-frame buffer — no additional camera access is needed
- References device registry (story 131) for device lookup and device health monitoring (story 136) for the diagnostics suite

---

## 139. Edge-to-Cloud Sync

**As an enterprise ops team member, edge devices sync detection data, metrics, and logs to the cloud platform for centralized analysis when connectivity allows.**

### Acceptance Criteria

- [ ] Each enrolled device runs a sync agent that continuously uploads detection results, health metrics, and logs to the cloud fleet server
- [ ] Detection data is synced via `POST /api/v1/fleet/sync/detections` with batched payloads: multiple detection frames are bundled into a single HTTPS request
- [ ] Metrics are synced via the existing MQTT health channel (story 136) with store-and-forward for offline periods (story 143)
- [ ] Logs are synced via `POST /api/v1/fleet/sync/logs` with structured JSON log entries batched and compressed with gzip
- [ ] Sync priority: health metrics (highest) → alerts → detection summaries → full detection data → logs (lowest). Bandwidth-constrained links sync high-priority data first
- [ ] `openeye device sync-status` shows the local sync queue: items pending, bytes pending, last successful sync timestamp, sync throughput (KB/s)
- [ ] Cloud-side sync ingestion endpoint at `POST /api/v1/fleet/sync/ingest` accepts multiplexed payloads containing detections, metrics, and logs in a single request to reduce HTTP overhead
- [ ] Data deduplication: each sync payload includes a `sync_id` (monotonically increasing per device). The server rejects duplicates and returns `200 OK` with `{"status": "duplicate", "last_sync_id": N}`
- [ ] Sync agent respects bandwidth limits: `--sync-bandwidth-limit 1mbps` throttles upload speed to avoid saturating the network link
- [ ] Sync data is encrypted in transit (TLS) and optionally at rest on the device: `--sync-encrypt-local` encrypts the local sync queue using the device's mTLS certificate
- [ ] Selective sync: `--sync-detections --no-sync-logs` allows operators to control what data types are synced per device via config (story 133)
- [ ] `openeye fleet sync-dashboard` on the fleet server shows sync status across all devices: last sync time, queue depths, throughput, and failed syncs

### Edge Cases

- [ ] Device is offline for an extended period (days): detection data, metrics, and logs accumulate in the local sync queue at `~/.openeye/sync-queue/`. Queue size is bounded by `--sync-queue-max-size` (default: 1GB). When the limit is reached, oldest low-priority data (logs) is evicted first
- [ ] Sync upload fails mid-transfer (network drop): the sync agent retries with exponential backoff (1s → 60s). Partially uploaded batches are idempotent — the server uses `sync_id` to detect and skip duplicates
- [ ] Bandwidth-constrained link (e.g., cellular modem at 100kbps): the sync agent automatically adjusts batch sizes and compression levels. Detection frame snapshots are downscaled or omitted based on available bandwidth. Priority-based sync ensures health metrics always get through
- [ ] Clock skew between device and cloud: sync payloads include both device-local timestamp and a server-assigned receipt timestamp. Analytics queries can use either. The fleet dashboard warns if skew exceeds 30 seconds
- [ ] Sync queue corruption (e.g., power loss during queue write): the queue uses a write-ahead log with CRC checksums per entry (similar to story 196). Corrupted entries are skipped with a warning and a `sync_queue_corruption` event is reported
- [ ] Server-side ingestion overload (1,000 devices syncing simultaneously after a network outage resolves): the server uses rate limiting per device (`--sync-rate-limit 10req/min`) and returns `429 Too Many Requests` with a `Retry-After` header. Devices respect the backoff
- [ ] Detection data contains large frame snapshots (5MB each): snapshots are synced separately from metadata. If `--sync-snapshots false` is set, only detection metadata (labels, bounding boxes, timestamps) is synced — reducing bandwidth by 95%+
- [ ] Conflicting sync data (device time was wrong, causing duplicate timestamps): the server uses `(device_id, sync_id)` as the unique key, not timestamps. Duplicate timestamps from the same device are stored as separate entries
- [ ] VPN/proxy environment: sync agent supports HTTP proxy (`--sync-proxy http://proxy:8080`) and SOCKS5 proxy (`--sync-socks5 socks5://proxy:1080`) for corporate network environments
- [ ] Sync agent process crash: on restart, the agent reads the queue from disk and resumes syncing from the last successful `sync_id`. No data is lost unless the queue files are corrupted
- [ ] TLS certificate expiry during extended offline: device's mTLS cert expires while offline — on reconnection, device cannot authenticate to sync
- [ ] Sync data contains adversarial payloads: detection JSON could contain SQL/XSS injection that is stored in cloud database and rendered in dashboard — no server-side input validation on sync payloads

### Technical Notes

- Sync agent at `cli/openeye_ai/fleet/sync_agent.py` runs as a background thread within the main OpenEye process
- Local sync queue uses a SQLite-based WAL at `~/.openeye/sync-queue/queue.db` with tables: `detections`, `metrics`, `logs`, each with `sync_id`, `timestamp`, `payload` (compressed JSON), `priority`, `synced` (boolean)
- Server-side ingestion at `backend/src/fleet/routes/sync.py` writes to the time-series database (metrics), the main database (detections), and the log aggregation system (logs)
- Compression uses zstd (level 3) for optimal compression ratio vs. CPU trade-off on edge devices
- References offline mode (story 143) for the store-and-forward mechanism, bandwidth-aware deployment (story 140) for bandwidth detection, and device health monitoring (story 136) for metric ingestion

---

## 140. Bandwidth-Aware Deployment

**As an enterprise ops team member, the fleet management system considers available bandwidth when deploying models or updates to bandwidth-constrained edge sites.**

### Acceptance Criteria

- [ ] Each device periodically measures its uplink/downlink bandwidth to the fleet server and reports it as part of health metrics (story 136): `bandwidth_down_kbps`, `bandwidth_up_kbps`, `bandwidth_measured_at`
- [ ] Bandwidth measurement uses a lightweight probe: `openeye device bandwidth-test` downloads a small test payload (100KB) and measures throughput — does not consume significant bandwidth itself
- [ ] `openeye fleet push-model --target site:warehouse-east --bandwidth-aware` checks the available bandwidth on target devices before deploying and schedules downloads to avoid saturating the link
- [ ] Bandwidth policies are configurable per-site: `openeye fleet site set-bandwidth --site warehouse-east --max-concurrent-downloads 2 --max-bandwidth 10mbps`
- [ ] The deployment scheduler staggers downloads across devices at a site: if 20 devices share a 10mbps link, downloads are serialized or limited to `--max-concurrent-downloads` (default: 3) to prevent congestion
- [ ] Low-bandwidth sites (< 1mbps) automatically receive delta updates (story 134/135) with maximum compression. If delta is not available, the deployment is flagged as `bandwidth_constrained` and the operator is alerted
- [ ] `GET /api/v1/fleet/sites/{site_id}/bandwidth` returns the current bandwidth profile for a site: measured bandwidth, active downloads, queued downloads, estimated completion time
- [ ] Deployment ETA: `openeye fleet push-model --target site:warehouse-east --bandwidth-aware --estimate` calculates and displays the estimated deployment time based on model size, available bandwidth, and concurrent download limits
- [ ] Off-peak scheduling: `--deploy-window "02:00-06:00"` restricts downloads to off-peak hours when bandwidth is typically underutilized
- [ ] Bandwidth monitoring dashboard: the fleet dashboard (story 132) shows per-site bandwidth utilization graphs and active/queued deployments
- [ ] Progressive quality: for model deployments, a lightweight quantized version can be deployed first (INT8, smaller) for immediate use, followed by the full-precision model during off-peak — `openeye fleet push-model --progressive`

### Edge Cases

- [ ] Bandwidth measurement returns 0 (network test blocked by firewall): the system uses the last known measurement if available (within `--bandwidth-stale-threshold`, default: 24h). If no measurement exists, defaults to a conservative assumption (1mbps) and logs a warning
- [ ] Satellite/cellular link with variable bandwidth: measurements are averaged over the last 5 probes with outlier rejection (discard top and bottom values). The 3-probe median is used for scheduling decisions
- [ ] All devices at a site start downloading simultaneously (race condition): the fleet server acts as the download coordinator. Devices request download slots via `POST /api/v1/fleet/bandwidth/request-slot`. The server grants slots based on the site's bandwidth policy and queues excess requests
- [ ] A device's download stalls (bandwidth drops to near-zero mid-transfer): the download is paused after `--stall-timeout` (default: 60s) of no progress. The slot is released for other devices. The stalled download resumes when the device re-requests a slot
- [ ] Site bandwidth policy is too restrictive (1 concurrent download on a 100mbps link): the system logs a suggestion to increase `--max-concurrent-downloads` based on measured bandwidth. `openeye fleet site auto-tune-bandwidth --site warehouse-east` automatically sets optimal values
- [ ] Mixed-bandwidth site (some devices on Ethernet, some on Wi-Fi): per-device bandwidth is tracked individually. The site-level policy applies to the aggregate link, while individual device limits are inferred from their measured bandwidth
- [ ] Bandwidth probe adds latency to inference during measurement: the probe runs in a separate thread with low priority and uses TCP window scaling to minimize interference. `--bandwidth-probe-interval` (default: 6 hours) controls how often probes run
- [ ] Deployment cancellation mid-download: `openeye fleet cancel-deployment --id <deployment-id>` cancels queued and in-progress downloads. Partially downloaded files are retained for resume if the deployment is re-triggered
- [ ] Metered connection (e.g., cellular with a data cap): `openeye fleet site set-bandwidth --site remote-site --data-cap 5gb-monthly` tracks cumulative data usage and pauses non-critical deployments when approaching the cap. Critical security updates are exempt
- [ ] Bandwidth probe gives misleading results (QoS prioritization): ISPs may prioritize small 100KB test payloads differently from large sustained transfers — probe too small to detect bufferbloat
- [ ] Slot starvation for low-priority devices: high-priority deployments continuously claim slots — no fairness scheduling or reservation

### Technical Notes

- Bandwidth measurement uses a TCP download test from the fleet server's `/api/v1/fleet/bandwidth/probe` endpoint (100KB payload with timing headers)
- Download coordination uses a semaphore-based slot system in `backend/src/fleet/services/bandwidth_scheduler.py` with per-site concurrency limits
- Device-side bandwidth agent at `cli/openeye_ai/fleet/bandwidth_agent.py` runs probes and reports results via the health metrics channel (story 136)
- Download queue is managed by the fleet server in `backend/src/fleet/models/download_queue.py` with fields: `device_id`, `deployment_id`, `priority`, `status`, `queued_at`, `started_at`, `completed_at`, `bytes_transferred`
- References OTA model updates (story 134), OTA software updates (story 135), device health monitoring (story 136), and edge-to-cloud sync (story 139) for bandwidth consumption awareness

---

## 141. Fleet Rollout Policies (Canary / Blue-Green)

**As an enterprise ops team member, I can define staged rollout policies for model and software updates across the fleet.**

### Acceptance Criteria

- [ ] `openeye fleet rollout create --name "yolov8-v2.1-rollout" --type canary --target site:warehouse-east --canary-percent 10 --validation-duration 30m` creates a canary rollout policy
- [ ] `openeye fleet rollout create --name "yolov8-v2.1-rollout" --type blue-green --target site:warehouse-east` creates a blue-green rollout where the new version runs alongside the old version on separate device groups
- [ ] `openeye fleet rollout create --name "security-patch" --type rolling --target all --batch-size 20 --batch-interval 10m` creates a rolling update across the entire fleet in batches
- [ ] Canary rollout stages: deploy to canary group (N%) → validate health metrics for `--validation-duration` → if healthy, promote to next stage (25%, 50%, 100%) → if unhealthy, auto-rollback canary group
- [ ] Blue-green rollout: deploy to "green" group → validate → shift traffic from "blue" (old) to "green" (new) → if unhealthy, shift back to "blue"
- [ ] Rolling update: deploy to batch 1 → validate → deploy to batch 2 → validate → continue. If any batch fails validation, halt rollout and rollback all updated devices
- [ ] Validation criteria are configurable: `--validate-fps-min 25 --validate-error-rate-max 0.05 --validate-latency-p95-max 50ms --validate-custom "openeye fleet run-test --suite smoke"`
- [ ] `openeye fleet rollout status --name "yolov8-v2.1-rollout"` shows current rollout stage, progress, validation results, and any issues
- [ ] `openeye fleet rollout pause --name "yolov8-v2.1-rollout"` pauses a rollout at the current stage. `openeye fleet rollout resume` continues from where it paused
- [ ] `openeye fleet rollout abort --name "yolov8-v2.1-rollout"` aborts the rollout and rolls back all devices that were updated in this rollout to their previous version
- [ ] `GET /api/v1/fleet/rollouts` lists all active and historical rollouts with filtering by status, target, and type
- [ ] `GET /api/v1/fleet/rollouts/{rollout_id}` returns detailed rollout state including per-device status, validation results, and timeline
- [ ] Rollout policies can be saved as templates: `openeye fleet rollout-template save --name "standard-canary" --type canary --canary-percent 10 --validation-duration 30m` for reuse across deployments
- [ ] Approval gates: `--require-approval` pauses the rollout before each stage promotion and sends a notification (email, Slack, PagerDuty) to the configured approvers. Approval via `openeye fleet rollout approve --name <name> --stage 2`

### Edge Cases

- [ ] Canary device selection: canary devices are randomly selected from the target group but ensure representation across hardware types (e.g., at least one Jetson Orin Nano, one Orin NX if both exist in the group). Selection can be overridden with `--canary-devices warehouse-cam-01,warehouse-cam-05`
- [ ] Validation window overlaps with maintenance window: if a scheduled maintenance event occurs during validation (e.g., devices restart for OS updates), the validation window is automatically extended by the maintenance duration to avoid false negatives
- [ ] Partial fleet failure during rolling update (batch 3 of 10 fails): batches 1-2 remain on the new version (already validated), batch 3 rolls back, batches 4-10 are not started. The operator can choose to `--force-continue` (skip failed batch) or `--rollback-all` (revert batches 1-2 as well)
- [ ] Blue-green rollout with insufficient devices: blue-green requires splitting the target group into two halves. If the group has an odd number of devices, the smaller half is "green" (new). If the group has only 1 device, blue-green falls back to canary with that device as the canary
- [ ] Rollout in progress when a new rollout is triggered for the same target: the new rollout is rejected with `409 Conflict`: "Rollout 'yolov8-v2.1-rollout' is in progress for target site:warehouse-east. Abort or complete the existing rollout first"
- [ ] Network partition during rollout: if a device becomes unreachable during its validation window, the rollout marks that device as `validation_incomplete`. The rollout does not proceed to the next stage until the device is reachable and validated, or the operator manually skips it
- [ ] Rollback during blue-green fails (old version was already removed from device): the rollback downloads the old version from the fleet model registry. If the old version is no longer available, the rollback fails with an error and the device remains on the new version with a `rollback_failed` alert
- [ ] Custom validation script times out: the rollout waits up to `--custom-validation-timeout` (default: 5 minutes). If the script does not return, the validation is marked `timeout` and treated as a failure (triggering rollback policy)
- [ ] Approval gate timeout: if no approval is received within `--approval-timeout` (default: 24h), the rollout is automatically paused and an escalation notification is sent to the backup approver
- [ ] Fleet-wide rollout across sites with different time zones: `--respect-timezone` ensures each site's rollout occurs during its local maintenance window. Sites in different time zones may be at different rollout stages simultaneously
- [ ] Rollout state persistence across fleet server restart: if fleet server crashes mid-rollout, state machine position may be lost — no durable state recovery or WAL
- [ ] Rolling update batch calculation with dynamic fleet: devices enrolling/decommissioning during update change total count — batch sizes become inconsistent
- [ ] Deterministic canary hash collision: hash `(device_id, rollout_id)` could consistently select same devices — no rotation or seed variation

### Technical Notes

- Rollout orchestration lives in `backend/src/fleet/services/rollout_engine.py` with a state machine: `created → canary_deploying → canary_validating → promoting → batch_N_deploying → batch_N_validating → completed | aborted | rolled_back`
- Rollout state is persisted in `backend/src/fleet/models/rollout.py` with per-device status tracking in `backend/src/fleet/models/rollout_device.py`
- Validation checks are performed by querying the health metrics API (story 136) for the devices in the current stage and comparing against the configured thresholds
- Blue-green traffic shifting is implemented at the fleet config level: the "active" model symlink is updated atomically on each device (same mechanism as story 134)
- Canary device selection uses a deterministic hash of `(device_id, rollout_id)` for reproducible selection — useful for debugging rollout issues
- References OTA model updates (story 134), OTA software updates (story 135), device health monitoring (story 136), and fleet alerting (story 145)

---

## 142. Device Lifecycle Management

**As an enterprise ops team member, I can manage the full device lifecycle: provision → activate → maintain → decommission → retire.**

### Acceptance Criteria

- [ ] Device lifecycle states: `provisioned` → `enrolling` → `active` → `maintenance` → `decommissioned` → `retired`. State transitions are enforced by the fleet server — invalid transitions (e.g., `retired` → `active`) are rejected
- [ ] `openeye fleet provision --name warehouse-cam-01 --site warehouse-east --config initial-config.yaml` creates a device record in `provisioned` state with its intended configuration before the physical device is online
- [ ] `openeye fleet activate --device warehouse-cam-01` transitions a device from `enrolling` to `active` after enrollment (story 131) and initial health check pass — inference begins
- [ ] `openeye fleet maintain --device warehouse-cam-01 --reason "firmware update" --duration 2h` puts a device in `maintenance` state, pausing alerting (story 145) and excluding it from rollouts (story 141) for the specified duration
- [ ] `openeye fleet decommission --device warehouse-cam-01 --reason "hardware failure"` transitions to `decommissioned`: stops inference, revokes credentials, removes from groups (story 137), but retains historical data
- [ ] `openeye fleet retire --device warehouse-cam-01 --purge-data` transitions to `retired`: deletes the device record and optionally purges all associated data (metrics, logs, detections) — requires `admin` role and confirmation
- [ ] `openeye fleet lifecycle --device warehouse-cam-01` shows the full lifecycle history: all state transitions with timestamps, operators, and reasons
- [ ] `GET /api/v1/fleet/devices/{device_id}/lifecycle` returns the lifecycle history as JSON
- [ ] Maintenance mode auto-exit: when the `--duration` expires, the device automatically transitions back to `active`. If the device is still unhealthy, it transitions to `active` with a `degraded` health status and triggers an alert
- [ ] Batch lifecycle operations: `openeye fleet decommission --filter "tag:site=warehouse-east AND status=offline AND last_seen < 30d"` decommissions all devices matching the filter
- [ ] Lifecycle webhooks: state transitions emit events on MQTT topic `openeye/fleet/lifecycle` with `device_id`, `from_state`, `to_state`, `reason`, `operator`, `timestamp` — consumed by external ITSM systems
- [ ] Asset tracking integration: `openeye fleet set-asset --device warehouse-cam-01 --asset-tag HW-2026-00142 --serial SN12345 --purchase-date 2026-01-15 --warranty-end 2028-01-15` attaches asset management metadata to the device record

### Edge Cases

- [ ] Device in `maintenance` state receives a config push (story 133): the config is queued and applied when the device returns to `active`. A warning is logged: "Config push queued for device warehouse-cam-01 (currently in maintenance)"
- [ ] Maintenance duration expires but the device is mid-update (story 135): the maintenance period is automatically extended until the update completes. The operator is notified of the extension
- [ ] Decommission a device that is currently part of a canary rollout (story 141): the device is removed from the rollout, and if it was a canary device, a replacement canary is selected. The rollout continues with the adjusted device set
- [ ] Retire a device with pending sync data (story 139): the retire operation warns "Device has 1,247 unsynced detection records. Use `--force` to retire without syncing, or sync data first with `openeye device sync --flush`"
- [ ] Re-provision a retired device (same hardware, new deployment): the device gets a new `device_id`. The old `device_id` remains in the retired state for audit purposes. A link between old and new records is maintained via `hardware_fingerprint`
- [ ] Device transitions to `maintenance` while actively serving a remote shell session (story 138): the shell session remains active. A warning is displayed in the shell: "This device is now in maintenance mode"
- [ ] Bulk decommission filter matches more devices than expected: `openeye fleet decommission --filter "..." --dry-run` shows the device list for review. Without `--dry-run`, operations affecting >10 devices require explicit confirmation unless `--yes` flag is passed
- [ ] Warranty expiry tracking: `openeye fleet list --filter "warranty_end < 30d"` lists devices with warranties expiring within 30 days. The fleet dashboard shows a warranty expiry widget
- [ ] State transition audit log is immutable: lifecycle entries cannot be modified or deleted, even by admins. The log is append-only and stored in `backend/src/fleet/models/lifecycle_log.py`
- [ ] Device in `decommissioned` state for >90 days without being retired: the fleet dashboard shows a "Stale Decommissioned Devices" alert suggesting retirement or re-provisioning
- [ ] Credential revocation propagation delay: on decommission, mTLS certificate added to CRL but MQTT brokers have CRL refresh delay — decommissioned device can still communicate
- [ ] Decommissioned device still physically running: unreachable during decommission, continues collecting data — no remote kill signal or data quarantine

### Technical Notes

- Lifecycle state machine is implemented in `backend/src/fleet/services/lifecycle_manager.py` with a state transition table enforcing valid transitions
- Valid transitions: `provisioned→enrolling`, `enrolling→active`, `active→maintenance`, `maintenance→active`, `active→decommissioned`, `maintenance→decommissioned`, `decommissioned→retired`
- Lifecycle events are published to MQTT topic `openeye/fleet/lifecycle` and stored in `backend/src/fleet/models/lifecycle_log.py` with fields: `device_id`, `from_state`, `to_state`, `reason`, `operator_id`, `timestamp`, `metadata` (JSON)
- Asset metadata is stored in `backend/src/fleet/models/device_asset.py` with fields for asset tag, serial number, purchase date, warranty end, location, and custom fields (JSON)
- Credential revocation on decommission: the device's mTLS certificate is added to a CRL (Certificate Revocation List) served at `GET /api/v1/fleet/crl`. The MQTT broker checks the CRL on connection
- References device registry (story 131), fleet grouping (story 137), fleet alerting (story 145), and remote shell (story 138)

---

## 143. Offline Mode & Store-and-Forward

**As an enterprise ops team member, edge devices continue operating fully offline and sync data when connectivity is restored.**

### Acceptance Criteria

- [ ] OpenEye inference continues running without any network connectivity — all models, configurations, and camera feeds operate locally
- [ ] Detection results are stored locally in an append-only SQLite database at `~/.openeye/offline-store/detections.db` with schema: `id`, `timestamp`, `model`, `detections_json`, `snapshot_path`, `synced` (boolean)
- [ ] Health metrics are buffered in a local ring buffer file at `~/.openeye/offline-store/metrics.bin` with a configurable max size (`--offline-metrics-buffer`, default: 50MB, ~24 hours of 15s-interval metrics)
- [ ] Logs are written to local rotating log files at `~/.openeye/logs/` with configurable max size (`--log-max-size 100mb`) and retention (`--log-retention 7d`)
- [ ] Connectivity detection: the device agent monitors connectivity to the fleet server via periodic MQTT pings (every 30s). Connection state transitions emit local events: `connectivity.lost` and `connectivity.restored`
- [ ] On connectivity restoration: the sync agent (story 139) replays the offline store in chronological order, marking entries as `synced` after successful upload. Sync progress is logged
- [ ] `openeye device offline-status` shows: current connectivity state, time since last connection, offline store size, entries pending sync, estimated sync time at current bandwidth
- [ ] Offline alert buffering: alerts that would have been sent (story 145) during the offline period are queued locally and transmitted on reconnection with `offline_buffered: true` and the original timestamp
- [ ] Config changes pushed during offline (story 133) are queued by the MQTT broker (QoS 1 with persistent sessions) and delivered on reconnection. The device applies queued configs in chronological order
- [ ] Local decision-making: webhook rules (story 195) can trigger local actions (e.g., GPIO pin toggle, local alarm) even when offline — the webhook HTTP call is queued for later delivery
- [ ] Offline store cleanup: after successful sync, synced entries older than `--offline-store-retention` (default: 48h) are purged from the local database to free disk space
- [ ] `openeye device offline-test` simulates offline mode for testing: disconnects from the fleet server, runs for `--duration` (default: 60s), reconnects, and reports the sync behavior

### Edge Cases

- [ ] Offline store exceeds disk space: when disk usage exceeds `--offline-max-disk-percent` (default: 90%), the oldest unsynced detection snapshots (images) are deleted first, retaining the metadata. If still over limit, oldest detection metadata is deleted. Metrics and logs are deleted last. Each eviction logs a `data_eviction` event
- [ ] Device is offline for weeks (extended outage): the offline store accumulates data up to its configured limits. On reconnection, sync may take hours. The sync agent uses bandwidth throttling (story 140) to avoid saturating the link. A `sync_backlog_warning` alert is sent to the fleet dashboard
- [ ] Power loss during offline store write: SQLite's WAL mode ensures atomic writes. On restart, the database recovers automatically. Partially written entries are rolled back
- [ ] Clock drift during extended offline period (no NTP): detection timestamps use the device's local monotonic clock for ordering. On reconnection, the time offset is calculated and all offline timestamps are adjusted by the delta. A `clock_correction` entry is logged
- [ ] Connectivity flapping (network goes up/down every few minutes): the sync agent uses a stability window (`--connectivity-stable-threshold`, default: 30s). Sync only begins after connectivity has been stable for the threshold duration to avoid partial syncs that waste bandwidth
- [ ] Multiple config versions queued during offline: configs are applied in chronological order. If an intermediate config is invalid, it is skipped with an error log, and the next config is attempted. The final active config is the last valid one in the queue
- [ ] Offline webhook queue grows very large (10,000+ queued webhook calls): on reconnection, webhook calls are replayed at a rate-limited pace (`--webhook-replay-rate`, default: 10/s) to avoid overwhelming the webhook endpoint. Time-sensitive webhooks older than `--webhook-max-age` (default: 24h) are discarded with a log
- [ ] Device reboots while offline: the offline store survives reboot (persisted to disk). On startup, the device detects it is still offline and continues appending to the existing store
- [ ] Concurrent local writes during sync: the sync agent reads and marks entries as synced while the inference pipeline continues appending new entries. SQLite's WAL mode supports concurrent readers and writers
- [ ] Offline mode with encrypted local store (`--offline-encrypt`): detection data at rest is encrypted using AES-256-GCM with the device's certificate key. If the certificate is rotated while offline, the old key is retained in a keyring for decrypting existing data
- [ ] SQLite database corruption beyond WAL recovery: WAL handles crash recovery but not media failures (SD card bad sectors) — corrupted database means all offline data lost
- [ ] Offline store encryption key loss: if `--offline-encrypt` enabled and device certificate key lost (TPM failure), all encrypted offline data unrecoverable — no key backup or escrow
- [ ] Connectivity restored to different fleet server (failover/migration): device may not authenticate to new server — no server discovery or migration

### Technical Notes

- Offline store uses SQLite in WAL mode for crash safety and concurrent access. Database at `~/.openeye/offline-store/detections.db`
- Metrics ring buffer uses a memory-mapped file with a fixed-size circular buffer structure — no SQLite overhead for high-frequency metric writes
- Connectivity monitor at `cli/openeye_ai/fleet/connectivity_monitor.py` uses MQTT PINGREQ/PINGRESP as the primary health check, with an HTTP fallback (`GET /api/v1/fleet/health`)
- Sync priority queue implementation in `cli/openeye_ai/fleet/sync_queue.py` uses a priority heap with data-type-based priorities: `CRITICAL` (alerts) > `HIGH` (metrics) > `MEDIUM` (detection metadata) > `LOW` (snapshots, logs)
- References edge-to-cloud sync (story 139) for the sync mechanism, remote configuration management (story 133) for queued configs, and fleet alerting (story 145) for buffered alerts

---

## 144. Multi-Site Fleet Deployment

**As an enterprise ops team member, I can manage devices across multiple physical sites with site-level grouping, policies, and reporting.**

### Acceptance Criteria

- [ ] `openeye fleet site create --name warehouse-east --location "New York, NY" --coordinates 40.7128,-74.0060 --timezone America/New_York --contact ops-east@company.com` creates a site definition
- [ ] `openeye fleet site list` shows all sites with device counts, online/offline status, and aggregate metrics (total FPS, average health score)
- [ ] `openeye fleet site dashboard --site warehouse-east` opens a site-specific dashboard showing only devices at that site with site-level summary metrics
- [ ] Site-level configuration: `openeye fleet push-config --site warehouse-east --config site-config.yaml` applies configuration to all devices at the site (story 133). New devices enrolling at the site automatically receive the site config
- [ ] Site-level policies: each site can define its own `maintenance_windows`, `bandwidth_limits`, `alerting_rules`, `rollout_schedule`, and `retention_policies`
- [ ] `openeye fleet site report --site warehouse-east --range 7d --output report.pdf` generates a site-level report: device inventory, uptime percentages, detection statistics, alert summary, model performance metrics
- [ ] Multi-site comparison: `openeye fleet site compare --sites warehouse-east,warehouse-west --metric inference_fps --range 24h` compares metrics across sites in a tabular or chart format
- [ ] `GET /api/v1/fleet/sites` returns all sites with summary statistics. `GET /api/v1/fleet/sites/{site_id}/devices` returns devices at a specific site
- [ ] Site hierarchy: sites can have sub-sites (`--parent warehouse-east`) for multi-building campuses. Policies and configs inherit from parent to child sites
- [ ] Cross-site model deployment: `openeye fleet push-model --model yolov8:v2.1 --target site:warehouse-east,site:warehouse-west --stagger 1h` deploys to sites sequentially with a configurable delay between sites
- [ ] Site-level access control: operators can be scoped to specific sites (`--site-scope warehouse-east`) — they can only view and manage devices at their assigned sites
- [ ] `openeye fleet site geo-map` displays an interactive map of all sites with device counts and health indicators
- [ ] Site decommission: `openeye fleet site decommission --site warehouse-east` decommissions all devices at the site (story 142) and archives the site record

### Edge Cases

- [ ] Site with zero devices: the site persists as an empty site in the registry. `openeye fleet site prune --min-inactive 90d` removes sites with no devices and no activity for the specified duration
- [ ] Duplicate site names: site names must be unique within the fleet. Creating a duplicate returns `409 Conflict`. Site IDs (UUIDs) are always unique
- [ ] Cross-site deployment with different timezones: `--respect-timezone` ensures each site's deployment occurs during its local maintenance window. `--stagger` is applied relative to each site's local time, not UTC
- [ ] Site comparison with different device counts (5 devices at site A, 500 at site B): metrics are normalized per-device by default (e.g., average FPS per device). Raw aggregate metrics are available with `--absolute`
- [ ] Site-level config conflicts with device-level overrides: the precedence order is `fleet-default → site-config → device-override` (story 133). The site report highlights devices with overrides that differ from the site config
- [ ] Site deletion with historical data: `openeye fleet site delete --site warehouse-east` is blocked if the site has historical data. `--archive` moves data to cold storage; `--purge` deletes permanently (requires `admin` role)
- [ ] Network partition isolates one site: the fleet dashboard shows the site as `unreachable` with the last known state. When connectivity is restored, the site's devices sync their offline data (story 143) and the dashboard updates
- [ ] Site report generation for a site with 500+ devices: the report is generated asynchronously. `openeye fleet site report --async` returns a `report_id` that can be polled via `openeye fleet site report-status --id <report_id>`. The completed report is downloadable from `GET /api/v1/fleet/reports/{report_id}/download`
- [ ] Moving a device between sites: `openeye fleet move --device warehouse-cam-01 --to-site warehouse-west` updates the device's site assignment, applies the new site's config, and logs the move in the device's lifecycle (story 142). The device retains its `device_id`
- [ ] Site coordinates inaccuracy: if coordinates are missing or obviously wrong (e.g., `0,0`), the geo-map omits the site with a "Location unknown" label and a notification to update the site's coordinates
- [ ] Site-level access control bypass via API: operators scoped to one site making direct API calls with another site's device IDs — no server-side enforcement on every endpoint
- [ ] Cross-site deployment fails partway through stagger: site A succeeds, site B fails — no per-site rollback or abort-all behavior

### Technical Notes

- Site model at `backend/src/fleet/models/site.py` with fields: `id`, `name`, `location`, `coordinates` (PostGIS geography type or lat/lng floats), `timezone`, `contact`, `parent_id`, `policies` (JSON), `created_at`, `decommissioned_at`
- Site hierarchy uses the same adjacency list + materialized path pattern as groups (story 137)
- Site-level reports are generated by `backend/src/fleet/services/report_generator.py` using data from the time-series database (story 136), detection store, and lifecycle log (story 142)
- PDF report generation uses `weasyprint` or `reportlab` for server-side rendering
- Geo-map uses Leaflet.js on the frontend with site markers at the configured coordinates. Map tiles are from OpenStreetMap (no API key required)
- Cross-site staggered deployment is orchestrated by `backend/src/fleet/services/deployment_scheduler.py` which creates per-site rollouts (story 141) with calculated start times based on site timezone and stagger interval
- References device registry (story 131), fleet grouping (story 137), remote configuration management (story 133), fleet rollout policies (story 141), and device lifecycle management (story 142)

---

## 145. Fleet Alerting & Escalation

**As an enterprise ops team member, I get configurable alerts when devices go offline, degrade performance, or report errors, with escalation chains.**

### Acceptance Criteria

- [ ] `openeye fleet alert create --name "device-offline" --condition "status=offline AND duration>5m" --severity critical --channel pagerduty --escalation ops-chain` creates an alert rule
- [ ] Alert conditions support device health metrics (story 136): `inference_fps < 10`, `cpu_percent > 95`, `gpu_temp_c > 85`, `error_rate > 0.1`, `disk_percent > 90`
- [ ] Alert conditions support fleet-level aggregates: `site:warehouse-east.online_count < 5`, `fleet.offline_percent > 10%`
- [ ] Alert channels: `email`, `slack`, `pagerduty`, `opsgenie`, `webhook`, `sms` (via Twilio), `msteams`
- [ ] `openeye fleet alert-config channels.yaml` configures alert channels with credentials and routing
- [ ] Escalation chains: `openeye fleet escalation create --name ops-chain --levels "L1:slack:ops-channel:0m,L2:pagerduty:ops-oncall:15m,L3:sms:eng-manager:30m"` defines a multi-level escalation with timing
- [ ] Alert deduplication: identical alerts (same condition, same device/group) within `--dedup-window` (default: 15 minutes) are coalesced — only one notification is sent
- [ ] Alert acknowledgment: `openeye fleet alert ack --alert-id <id> --message "investigating"` acknowledges an alert, pausing escalation. If not resolved within `--ack-timeout` (default: 1h), escalation resumes
- [ ] Alert resolution: alerts auto-resolve when the condition clears (e.g., device comes back online). A resolution notification is sent to the same channel
- [ ] `openeye fleet alerts` lists all active alerts with severity, affected devices, duration, and acknowledgment status
- [ ] `GET /api/v1/fleet/alerts` returns active alerts as JSON with filtering by severity, device, site, and status (active, acknowledged, resolved)
- [ ] `GET /api/v1/fleet/alerts/history?range=7d` returns historical alerts for trend analysis
- [ ] Alert muting: `openeye fleet alert mute --device warehouse-cam-01 --duration 2h --reason "planned maintenance"` suppresses alerts for a specific device during maintenance (integrates with lifecycle management story 142)
- [ ] Fleet-wide alert summary: the fleet dashboard (story 132) shows an alert timeline, alert counts by severity, and top alerting devices/sites

### Edge Cases

- [ ] Alert storm (50+ devices go offline simultaneously — e.g., network outage at a site): alerts are grouped by site. Instead of 50 individual "device offline" alerts, a single "Site warehouse-east: 50 devices offline" alert is sent. Individual device alerts are suppressed and linked to the site-level alert
- [ ] PagerDuty API rate limit (429): the alert system retries with the `Retry-After` header. If rate-limited for >5 minutes, alerts are queued locally and a fallback notification is sent via email
- [ ] Slack channel does not exist or bot lacks permissions: the alert delivery fails with a `channel_not_found` or `not_in_channel` error. The alert is retried via the next channel in the escalation chain, and a `channel_error` meta-alert is sent to the admin email
- [ ] Escalation chain has no available responders (e.g., PagerDuty oncall is empty): the alert escalates to the next level immediately. If all levels are exhausted, a `escalation_exhausted` meta-alert is sent to the fleet admin email configured in `openeye fleet config`
- [ ] Alert condition uses a metric that the device does not report (e.g., `gpu_temp_c` on a CPU-only device): the condition is skipped for that device with a debug-level log. The alert rule remains active for devices that do report the metric
- [ ] Alert fires during a scheduled maintenance window (story 142): the alert is suppressed and logged as `suppressed_maintenance`. The suppressed alert count is visible in the fleet dashboard. On maintenance exit, if the condition still holds, the alert fires immediately
- [ ] Flapping: a device oscillates between healthy and unhealthy rapidly (e.g., CPU spikes every 30 seconds): the alert system uses a `--flap-detection-window` (default: 5 minutes, 3 state changes). Flapping devices trigger a single `flapping` alert instead of repeated fire/resolve cycles
- [ ] Alert acknowledgment by an unauthorized user: ack requires `operator` or `admin` role. Unauthorized ack attempts are rejected and logged in the audit trail
- [ ] Time-based alert conditions (e.g., "device offline for >5 minutes"): the alert engine evaluates conditions on a polling interval (`--alert-eval-interval`, default: 30s). The actual alert may fire up to 30s after the 5-minute threshold is reached. For critical alerts, `--alert-eval-interval 10s` is recommended
- [ ] Alert channel credential rotation (e.g., PagerDuty API key changes): `openeye fleet alert-config update --channel pagerduty --api-key <new-key>` hot-reloads the channel without restarting the alert engine. Active alerts are not re-sent on credential update
- [ ] Timezone-aware alert conditions: `--active-hours "08:00-20:00 America/New_York"` only fires alerts during business hours. Outside active hours, alerts are suppressed and queued for delivery at the start of the next active period
- [ ] Alert with no matching devices (e.g., filter returns empty set): the rule is created but marked as `no_matching_devices`. When a device matching the filter appears (e.g., new enrollment), the rule automatically starts evaluating
- [ ] Alert engine single point of failure: runs as periodic loop in backend — if process crashes, no alerts fire. No HA, failover, or watchdog
- [ ] Alert condition evaluation at scale (10K devices × 50 rules): 500K evaluations per 30s cycle — no performance budget or query optimization
- [ ] Webhook alert channel SSRF: malicious admin configures webhook URL targeting internal infrastructure — no URL validation or SSRF protection
- [ ] Escalation chain circular reference: if levels loop (L3 → L1), infinite notifications — no cycle detection

### Technical Notes

- Alert engine at `backend/src/fleet/services/alert_engine.py` runs a periodic evaluation loop that queries health metrics (story 136) and device status (story 131) against configured alert rules
- Alert rules are stored in `backend/src/fleet/models/alert_rule.py` with fields: `id`, `name`, `condition` (parsed expression), `severity`, `channel_ids`, `escalation_chain_id`, `dedup_window`, `flap_window`, `active_hours`, `enabled`
- Alert state is tracked in `backend/src/fleet/models/alert_instance.py` with fields: `id`, `rule_id`, `device_id`, `status` (firing, acknowledged, resolved, suppressed), `fired_at`, `acked_at`, `acked_by`, `resolved_at`, `escalation_level`
- Channel integrations at `backend/src/fleet/alerts/channels/` with `slack.py`, `pagerduty.py`, `opsgenie.py`, `email.py`, `sms.py`, `msteams.py`, `webhook.py` — each implements a `send(alert)` method
- Escalation chains are stored in `backend/src/fleet/models/escalation_chain.py` with ordered levels, each referencing a channel and a delay duration
- Alert storm detection uses a sliding window counter per site. If the counter exceeds `--storm-threshold` (default: 10 alerts in 60 seconds), the engine switches to site-level aggregation
- References device health monitoring (story 136) for metric-based conditions, device lifecycle management (story 142) for maintenance suppression, fleet dashboard (story 132) for visualization, and device registry (story 131) for device/site filtering
