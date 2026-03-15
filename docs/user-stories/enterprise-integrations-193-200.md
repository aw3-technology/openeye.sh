# Enterprise Integrations (193–200)

---

## 193. Kafka / Kinesis Event Streaming

**As an enterprise developer, I can send detection events to our Kafka/Kinesis stream for downstream analytics pipelines.**

### Acceptance Criteria

- [ ] `openeye watch --sink kafka --broker broker1:9092 --topic openeye-detections` publishes each detection frame as a Kafka message
- [ ] `openeye watch --sink kinesis --stream openeye-detections --region us-east-1` publishes to an AWS Kinesis Data Stream
- [ ] Each message is a JSON-serialized `PredictionResult` with added `source_id`, `timestamp`, and `stream_metadata` fields
- [ ] Kafka sink supports SASL/SSL authentication: `--kafka-sasl-mechanism PLAIN --kafka-username ... --kafka-password ...`
- [ ] Kafka sink supports Schema Registry integration: `--schema-registry http://registry:8081` publishes Avro-encoded messages with auto-registered schemas
- [ ] Kinesis sink authenticates via standard AWS credential chain (env vars, `~/.aws/credentials`, IAM role, IRSA)
- [ ] Kafka partition key is configurable: `--partition-key source_id` (default), `--partition-key timestamp`, or `--partition-key custom:<field>`
- [ ] Kinesis partition key defaults to `source_id` for even shard distribution
- [ ] Message batching is configurable: `--batch-size 100 --batch-linger-ms 500` for throughput optimization
- [ ] `--sink-filter` allows publishing only specific event types: `--sink-filter "person_detected,vehicle_detected,hazard"`
- [ ] Dead letter queue support: `--dlq-topic openeye-dlq` for messages that fail to publish after retries
- [ ] Sink dependencies are optional: `pip install openeye-sh[kafka]` installs `confluent-kafka`; `pip install openeye-sh[kinesis]` installs `boto3`

### Edge Cases

- [ ] Kafka broker unreachable on startup: retries connection with exponential backoff (1s, 2s, 4s, ... up to 60s) and logs each attempt — does not block the perception pipeline; frames are dropped (or buffered if `--buffer-on-disconnect` is set, up to `--buffer-max 10000` messages)
- [ ] Kafka broker goes down mid-stream: buffered messages are retried with `--kafka-retries` (default: 5) and `--retry-backoff-ms` (default: 100). After exhausting retries, messages are sent to the DLQ if configured, otherwise logged and dropped
- [ ] Kinesis `ProvisionedThroughputExceededException`: applies backoff and retries. If sustained, logs a warning suggesting shard count increase
- [ ] Kinesis shard iterator expiration (>5 min idle on consumer side): not applicable to producer, but if `--sink kinesis` is used with a read-back verification mode, handles re-acquisition
- [ ] Schema evolution: if `PredictionResult` gains new fields in a version upgrade, Avro schema is registered as a new version — existing consumers using older schema continue to work (backward-compatible evolution)
- [ ] Messages exceeding Kafka's `message.max.bytes` (default: 1MB) — e.g., frames with large depth maps — are automatically split into chunked messages with a `chunk_id` and `total_chunks` header, or rejected with a clear error if chunking is disabled
- [ ] Kinesis max record size (1MB): oversized payloads are compressed with gzip and a `Content-Encoding: gzip` attribute is set. If still over 1MB, the depth map is stripped and a `payload_truncated` flag is added
- [ ] If both `--sink kafka` and `--sink kinesis` are specified, events fan out to both sinks independently — failure in one does not block the other
- [ ] Kafka topic auto-creation: if `--kafka-auto-create-topic` is set and the topic doesn't exist, creates it with configurable partitions and replication factor. Otherwise, fails with a clear error listing available topics
- [ ] Graceful shutdown (`Ctrl+C`): flushes all buffered messages before exiting. If flush takes longer than `--shutdown-timeout` (default: 10s), logs the number of un-flushed messages and exits
- [ ] SASL token refresh/expiry during long-running streams: no handling for Kafka SASL OAUTHBEARER token with TTL — mid-stream re-authentication not described
- [ ] Schema Registry unavailability: if `--schema-registry` is unreachable at startup or mid-stream, no fallback behavior described (fail open with JSON? buffer? halt?)
- [ ] Kinesis per-record failures within batch: `put_records` can return partial failures per record — no per-record error handling within a batch
- [ ] DLQ topic itself unavailable: if DLQ Kafka topic is unavailable, messages sent to DLQ also fail — no fallback for DLQ failure
- [ ] Message ordering guarantee: no discussion of whether ordering is guaranteed within partition key or if batching/retries reorder (librdkafka `enable.idempotence`)

### Technical Notes

- Kafka sink uses `confluent-kafka` Python client (librdkafka-based) for high throughput
- Kinesis sink uses `boto3` with the `put_records` batch API
- Sink logic lives in `cli/openeye_ai/sinks/kafka.py` and `cli/openeye_ai/sinks/kinesis.py`
- Both sinks implement a common `EventSink` interface with `publish(event)`, `flush()`, and `close()` methods
- Message schema aligns with the CloudEvents specification where possible (`source`, `type`, `time`, `data`)

---

## 194. Video Management System (VMS) Integration

**As an enterprise developer, I can integrate with our existing video management system (VMS) — Milestone, Genetec, or RTSP streams.**

### Acceptance Criteria

- [ ] `openeye watch --input milestone://server:8080/camera/1 --milestone-token <auth>` connects to Milestone XProtect via the MIP SDK REST API
- [ ] `openeye watch --input genetec://server:4590/camera/<guid>` connects to Genetec Security Center via the Web SDK
- [ ] `openeye watch --input rtsp://server:554/stream1` works with any ONVIF-compliant camera or VMS that exposes RTSP
- [ ] Milestone integration supports live and playback modes: `--milestone-mode live` (default) or `--milestone-mode playback --from "2026-03-01T00:00:00Z" --to "2026-03-01T01:00:00Z"`
- [ ] Genetec integration supports receiving bookmarks/events from Security Center and correlating them with OpenEye detections
- [ ] ONVIF discovery: `openeye discover --onvif` scans the local network for ONVIF cameras and lists their RTSP stream URLs
- [ ] Multi-camera support: `--input milestone://server:8080/cameras?group=Warehouse` connects to all cameras in a Milestone camera group
- [ ] Detections can be pushed back to the VMS as metadata overlays: `--vms-overlay` draws bounding boxes on the VMS live view
- [ ] Alarm integration: `--vms-alarm` creates alarms in the VMS when specific detections occur (e.g., `--alarm-on "person" --alarm-zone "restricted"`)
- [ ] VMS authentication supports OAuth2, Basic Auth, and API key methods
- [ ] Camera PTZ control: `openeye ptz --input milestone://... --track person` auto-tracks detected objects using PTZ commands via the VMS API
- [ ] VMS dependencies are optional: `pip install openeye-sh[vms]`

### Edge Cases

- [ ] Milestone session expiry: if the MIP SDK auth token expires mid-stream, transparently re-authenticates without dropping frames — logs a debug-level message about token refresh
- [ ] Genetec failover: if the connected Security Center directory server fails over to a standby, the adapter detects the redirect and reconnects to the new server
- [ ] RTSP stream loss (network blip, camera reboot): reconnects with exponential backoff (1s → 30s). During reconnection, inference pipeline pauses — does not crash or output stale frames
- [ ] Multi-camera group with mixed resolutions: each camera stream is independently scaled to the model's input size — no assumption of uniform resolution
- [ ] VMS overlay: if the VMS does not support metadata overlays (older firmware), logs a warning and continues inference without overlay — does not block operation
- [ ] ONVIF discovery on a network with >100 cameras: results are paginated and discovery timeout is configurable (`--discover-timeout`, default: 10s) to avoid flooding the network
- [ ] Milestone playback mode: if the requested time range has no recorded video, returns a clear error with the nearest available time range
- [ ] PTZ tracking with multiple targets: `--track-priority nearest|largest|highest-confidence` determines which object the PTZ follows. Default: `highest-confidence`
- [ ] If PTZ control permissions are not granted to the API user, `--track` fails with a clear permissions error — does not silently degrade
- [ ] Camera credentials containing special characters (e.g., `@`, `#`, `:`) in the RTSP URL must be URL-encoded — logs a hint if authentication fails with a URL containing unencoded special chars
- [ ] VMS with hundreds of simultaneous streams: `--max-concurrent-streams` (default: 8) limits how many streams are processed in parallel to avoid GPU/CPU saturation
- [ ] Network bandwidth saturation: if total incoming stream bandwidth exceeds `--max-bandwidth` (e.g., `500mbps`), deprioritizes lower-priority cameras (configurable via `--camera-priority`)
- [ ] RTSP TCP/UDP fallback: some networks drop UDP — no automatic transport negotiation or fallback from UDP to TCP
- [ ] H.265/HEVC decode failures: some cameras stream H.265 but not all FFmpeg builds include HEVC support — no codec negotiation or fallback
- [ ] PTZ command rate limiting: rapid tracking commands can overwhelm camera motor or VMS API — no command debouncing
- [ ] Memory leak from long-running RTSP sessions: OpenCV FFmpeg backend has known memory leak issues — no periodic reconnection or resource monitoring
- [ ] Concurrent VMS overlay writes from multiple instances: overlays may conflict or flicker — no coordination mechanism

### Technical Notes

- Milestone integration uses the MIP SDK REST/WebSocket APIs (OpenAPI-based)
- Genetec integration uses the Web SDK REST API
- ONVIF discovery uses the `onvif-zeep` Python library
- RTSP input uses OpenCV `VideoCapture` with `CAP_FFMPEG` backend (same as drone story 88)
- VMS adapters live in `cli/openeye_ai/adapters/vms/` with `milestone.py`, `genetec.py`, `onvif.py`
- PTZ commands are issued via ONVIF PTZ profile or VMS-specific APIs

---

## 195. Webhook Event Triggers

**As an enterprise developer, I can trigger webhooks on specific detection events (e.g., "person detected in restricted zone" → POST to our incident system).**

### Acceptance Criteria

- [ ] `openeye watch --webhook https://incident.corp.com/api/events` sends a POST request on every detection event
- [ ] Webhook rules are configurable via a YAML file: `openeye watch --webhook-config rules.yaml`
- [ ] Rule engine supports conditions: `label`, `confidence_gte`, `zone` (named region of interest), `time_window`, `count_gte` (N detections in M seconds)
- [ ] Example rule: `label: person AND zone: restricted AND time: 22:00-06:00 → POST https://incident.corp.com/api/alert`
- [ ] Each webhook POST includes: detection details, source camera, timestamp, frame snapshot (base64 JPEG), rule that triggered
- [ ] Webhook payload is customizable via a Jinja2 template: `--webhook-template template.json.j2`
- [ ] Supports multiple webhook endpoints with independent rules in a single config file
- [ ] Authentication: `Authorization: Bearer <token>`, custom headers, or mTLS client certificates
- [ ] Retry policy: configurable retries (default: 3) with exponential backoff for failed deliveries
- [ ] Deduplication: `--webhook-cooldown 60` suppresses duplicate alerts for the same rule+zone within the cooldown period (seconds)
- [ ] `--webhook-test` sends a test payload to all configured endpoints on startup and reports success/failure
- [ ] Webhook delivery log: `--webhook-log webhook_deliveries.jsonl` logs every delivery attempt with status code and latency

### Edge Cases

- [ ] Webhook endpoint returns 5xx: retries with backoff (1s, 2s, 4s). After `--webhook-max-retries` failures, logs the failed payload to `--webhook-log` and moves on — does not block the perception pipeline
- [ ] Webhook endpoint returns 4xx: does not retry (client error is not transient). Logs the response body for debugging
- [ ] Endpoint SSL certificate validation: enabled by default. `--webhook-insecure` disables verification (with a warning). If the cert is expired, logs the expiration date in the error
- [ ] If the frame snapshot is too large for the webhook payload (endpoint rejects >1MB), auto-compresses the JPEG to `--webhook-max-snapshot-size` (default: 500KB) by reducing quality
- [ ] Zone-based rules: if a detection's bounding box partially overlaps a zone, it triggers if the overlap exceeds `--zone-overlap-threshold` (default: 0.5 / 50%)
- [ ] `count_gte` rule with time window: uses a sliding window. Example: "5 people in zone X within 30 seconds" — the counter resets when the window slides, not when an alert fires
- [ ] Webhook config YAML validation: on startup, validates all rules against a JSON schema. Invalid rules log a descriptive error and are skipped — valid rules still execute
- [ ] If the Jinja2 template renders invalid JSON, the webhook is not sent and the template error is logged with the template line number
- [ ] Network partition: if all webhook deliveries fail for >5 minutes, logs a `WEBHOOK_UNREACHABLE` warning at 1-minute intervals — does not spam logs
- [ ] `Ctrl+C` during operation: drains the webhook delivery queue (up to `--shutdown-timeout` seconds) before exiting — in-flight retries are abandoned
- [ ] Clock skew: if the system clock is adjusted (NTP correction), `time_window`-based rules use monotonic clock internally to avoid false triggers
- [ ] HMAC signing: `--webhook-secret <key>` signs the payload with HMAC-SHA256 and includes the signature in `X-OpenEye-Signature` header for verification by the receiving system
- [ ] Webhook endpoint returning 3xx redirects: no handling for HTTP redirects — should `httpx` follow? What about redirect loops or open redirect attacks?
- [ ] HMAC replay attacks: HMAC signing with `X-OpenEye-Signature` but no timestamp/nonce in signed payload — replay attacks possible
- [ ] Jinja2 template injection (SSTI): user-supplied templates could execute arbitrary code via sandbox escape — no `SandboxedEnvironment` mentioned
- [ ] Zone polygon degenerate validation: no handling for fewer than 3 vertices, zero-area polygons, or coordinates outside 0-1 normalized range
- [ ] Environment variable references unset: config uses `${INCIDENT_API_TOKEN}` — no edge case for unset env var (empty string? fail? placeholder leak?)

### Technical Notes

- Webhook engine lives in `cli/openeye_ai/webhooks/engine.py` with rule parsing in `rules.py`
- Zone definitions are loaded from `--zones zones.yaml` — each zone is a named polygon `[(x1,y1), (x2,y2), ...]` in normalized coordinates
- Delivery uses `httpx.AsyncClient` for non-blocking HTTP calls
- Rule evaluation happens per-frame after detection, before output formatting
- Jinja2 templates have access to the full `PredictionResult`, `rule`, `zone`, and `camera` context

### Example Config

```yaml
# webhook-config.yaml
endpoints:
  - url: https://incident.corp.com/api/alerts
    auth:
      type: bearer
      token: ${INCIDENT_API_TOKEN}
    rules:
      - name: after-hours-intrusion
        conditions:
          label: person
          zone: restricted
          time: "22:00-06:00"
          confidence_gte: 0.7
        cooldown: 300  # 5 minutes

  - url: https://slack.corp.com/webhook/security
    rules:
      - name: crowd-detection
        conditions:
          label: person
          count_gte: 10
          time_window: 30
        template: slack_alert.json.j2
        cooldown: 60
```

---

## 196. Data Lake Connector

**As an enterprise developer, I can connect OpenEye to our data lake (Snowflake, BigQuery, Databricks) for long-term analytics.**

### Acceptance Criteria

- [ ] `openeye watch --sink snowflake --snowflake-account xyz.us-east-1 --snowflake-db analytics --snowflake-table detections` streams detection data to Snowflake
- [ ] `openeye watch --sink bigquery --bq-project my-project --bq-dataset openeye --bq-table detections` streams to BigQuery
- [ ] `openeye watch --sink databricks --databricks-host https://xxx.cloud.databricks.com --databricks-table catalog.schema.detections` streams to Databricks Unity Catalog
- [ ] Each row includes: `detection_id` (UUID), `timestamp`, `source_id`, `model`, `label`, `confidence`, `bbox_x`, `bbox_y`, `bbox_w`, `bbox_h`, `scene_description`, `metadata` (JSON), `frame_snapshot_url` (optional)
- [ ] Schema is auto-created on first write if the table doesn't exist (`--auto-create-table`, default: true)
- [ ] Frame snapshots are optionally stored to object storage (S3/GCS/ABFS) with the URL reference saved in the table: `--snapshot-bucket s3://openeye-frames/`
- [ ] Batch insert mode: rows are buffered and flushed every `--flush-interval` seconds (default: 10) or `--flush-count` rows (default: 1000), whichever comes first
- [ ] Snowflake authentication: key-pair auth (`--snowflake-private-key`), OAuth, or username/password
- [ ] BigQuery authentication: service account JSON (`--bq-credentials`), application default credentials, or workload identity
- [ ] Databricks authentication: PAT (`--databricks-token`), OAuth, or Azure AD
- [ ] Partitioning: Snowflake tables are clustered by `timestamp`; BigQuery tables are partitioned by `DATE(timestamp)`; Databricks tables use liquid clustering on `timestamp`
- [ ] Data lake dependencies are optional: `pip install openeye-sh[snowflake]`, `[bigquery]`, `[databricks]`

### Edge Cases

- [ ] Snowflake warehouse is suspended: auto-resumes the warehouse on first write (requires `OPERATE` privilege). If auto-resume is disabled, fails with a clear error about warehouse state
- [ ] BigQuery streaming insert quota exceeded (max 50,000 rows/sec per table): backs off and buffers locally, logging a warning about quota limits
- [ ] Databricks cluster is stopped: if using a SQL warehouse, returns a `CLUSTER_NOT_RUNNING` error with instructions to start it. If using serverless, no issue
- [ ] Network interruption during flush: buffered rows are preserved in a local WAL (write-ahead log) file at `~/.openeye/wal/<sink>/`. On reconnection, the WAL is replayed — no data loss
- [ ] WAL file grows beyond `--wal-max-size` (default: 100MB): oldest entries are evicted with a warning about potential data loss
- [ ] Schema drift: if `PredictionResult` adds new fields in a version upgrade, the connector issues `ALTER TABLE ADD COLUMN` for new fields (if `--auto-evolve-schema` is set). Otherwise, new fields are stored in the `metadata` JSON column
- [ ] Duplicate detection: each row has a unique `detection_id`. If a WAL replay re-inserts rows, Snowflake/BigQuery/Databricks deduplication (via `MERGE` or idempotent insert) prevents duplicates
- [ ] Snapshot upload to S3 fails (e.g., bucket permissions): the detection row is still written with `frame_snapshot_url` set to `null` and a warning is logged — data ingestion is not blocked by snapshot failures
- [ ] BigQuery table with required columns that OpenEye doesn't provide: fails with a clear schema mismatch error listing the missing required columns
- [ ] Concurrent writers: if multiple `openeye watch` instances write to the same table, each uses a unique `writer_id` to avoid WAL conflicts
- [ ] Cost awareness: `--dry-run` logs what would be written without actually inserting data, so users can estimate costs before enabling the sink
- [ ] WAL corruption behavior: WAL uses CRC checksums but no described behavior when CRC fails on replay (skip? abort? log and continue?)
- [ ] BigQuery Storage Write API stream commit failures: if process crashes between writing and committing, orphaned streams left pending — no cleanup
- [ ] Object storage credential expiry for snapshots: snapshot bucket credentials may have separate chain from data lake creds — no independent refresh
- [ ] Network timeout during ALTER TABLE ADD COLUMN: if schema evolution DDL times out, next flush fails with schema mismatch — no transactional guarantee
- [ ] Secrets in WAL file: WAL on disk may contain sensitive metadata — no WAL encryption at rest

### Technical Notes

- Snowflake sink uses the `snowflake-connector-python` with `write_pandas` or `PUT`/`COPY` for batch inserts
- BigQuery sink uses `google-cloud-bigquery` with the Storage Write API for streaming
- Databricks sink uses `databricks-sql-connector` or the REST API for Unity Catalog tables
- Sink logic lives in `cli/openeye_ai/sinks/snowflake.py`, `bigquery.py`, `databricks.py`
- All sinks implement the `EventSink` interface (same as story 193)
- WAL implementation in `cli/openeye_ai/sinks/wal.py` — append-only binary file with CRC checksums per entry

---

## 197. Infrastructure as Code (Terraform / Pulumi)

**As an enterprise developer, I can use Terraform/Pulumi providers to provision OpenEye infrastructure as code.**

### Acceptance Criteria

- [ ] A Terraform provider `terraform-provider-openeye` is published to the Terraform Registry
- [ ] A Pulumi provider `pulumi-openeye` is published to the Pulumi Registry
- [ ] Resources supported: `openeye_server` (managed OpenEye inference server), `openeye_camera` (camera source configuration), `openeye_model` (model deployment), `openeye_webhook` (webhook configuration), `openeye_zone` (detection zone), `openeye_api_key` (API key management)
- [ ] `openeye_server` resource provisions an inference server with configurable: instance type, model, GPU allocation, replica count, auto-scaling rules
- [ ] `openeye_camera` resource configures a camera source: RTSP URL, credentials, frame rate, resolution, assigned server
- [ ] `openeye_model` resource manages model lifecycle: pull, deploy, version pin, rollback
- [ ] `openeye_webhook` resource manages webhook rules (mirrors story 195 config) with full CRUD
- [ ] `openeye_zone` resource defines named detection zones with polygon coordinates and associated rules
- [ ] `openeye_api_key` resource creates/rotates API keys with configurable expiry and scope
- [ ] Data sources: `openeye_models` (list available models), `openeye_cameras` (list registered cameras), `openeye_server_status` (health check)
- [ ] Provider authenticates via API key: `provider "openeye" { api_key = var.openeye_api_key, endpoint = "https://api.openeye.example.com" }`
- [ ] All resources support `import` for adopting existing infrastructure
- [ ] Pulumi provider supports Python, TypeScript, Go, and C# SDKs (auto-generated from the Terraform provider schema via `pulumi-terraform-bridge`)

### Edge Cases

- [ ] `terraform plan` on an `openeye_server` with a model change: shows a `forces replacement` warning since model changes require server re-provisioning. In-place updates are not possible for model swaps
- [ ] `openeye_camera` with an unreachable RTSP URL: `terraform apply` validates the URL format but defers connectivity checks to the server — resource is created with a `status: unreachable` attribute that can be checked via data source
- [ ] `openeye_api_key` rotation: when `rotation_days` triggers a rotation, the old key remains valid for a `grace_period` (default: 24h) to avoid downtime during rollout
- [ ] Concurrent `terraform apply` runs targeting the same resources: the OpenEye API uses optimistic concurrency (ETags) to prevent conflicts — Terraform retries on `409 Conflict`
- [ ] Provider version mismatch with API version: if the API introduces breaking changes, the provider logs a deprecation warning and continues working with the older API version until the next major provider release
- [ ] `terraform destroy` on `openeye_server` with active streams: the server is drained (in-flight requests complete) before termination. `--force-destroy` skips drain
- [ ] Import of resources created outside Terraform: `terraform import openeye_server.main <server-id>` populates the state. Missing optional attributes are set to provider defaults
- [ ] Rate limiting: the provider respects `429 Too Many Requests` from the API and retries with the `Retry-After` header value
- [ ] `openeye_zone` polygon validation: rejects self-intersecting polygons at plan time with a clear error showing the intersecting edges
- [ ] Large deployments (>50 cameras, >10 servers): provider uses pagination for list operations and supports `--parallelism` flag in Terraform for concurrent resource creation
- [ ] Terraform state containing sensitive data: state stored locally has API keys in plaintext — no mention of state encryption (S3 backend with KMS)
- [ ] Provider crash during `terraform apply`: some resources created but not in state — no reconciliation beyond `terraform import`
- [ ] Self-referential API key rotation: if provider's own API key is being rotated, provider loses access mid-apply
- [ ] Provider proxy/VPN requirements: enterprise environments require proxy — no `HTTPS_PROXY` or custom CA cert support

### Technical Notes

- Terraform provider is written in Go using the `terraform-plugin-framework`
- Pulumi provider is bridged from the Terraform provider using `pulumi-terraform-bridge`
- Provider source code lives in `terraform/` directory
- API interactions use the OpenEye management API (separate from the inference API)
- State is stored in Terraform state file — sensitive fields (API keys, credentials) are marked `sensitive` in the schema
- CI/CD publishes the provider on every tagged release via GitHub Actions

### Example (Terraform)

```hcl
provider "openeye" {
  api_key  = var.openeye_api_key
  endpoint = "https://api.openeye.example.com"
}

resource "openeye_server" "warehouse" {
  name     = "warehouse-perception"
  model    = "yolov8"
  replicas = 2
  gpu      = "nvidia-t4"

  autoscaling {
    min_replicas = 1
    max_replicas = 5
    target_fps   = 30
  }
}

resource "openeye_camera" "entrance" {
  name      = "warehouse-entrance"
  rtsp_url  = var.entrance_camera_url
  server_id = openeye_server.warehouse.id
  fps       = 15
}

resource "openeye_zone" "restricted" {
  name      = "restricted-area"
  camera_id = openeye_camera.entrance.id
  polygon   = [[0.1, 0.2], [0.9, 0.2], [0.9, 0.8], [0.1, 0.8]]
}

resource "openeye_webhook" "intrusion_alert" {
  name     = "intrusion-alert"
  url      = "https://incident.corp.com/api/alerts"
  zone_id  = openeye_zone.restricted.id
  rule {
    label          = "person"
    confidence_gte = 0.7
    time           = "22:00-06:00"
  }
  cooldown = 300
}
```

---

## 198. Ticketing System Integration (Jira / ServiceNow)

**As an enterprise developer, I can integrate with our ticketing system (Jira, ServiceNow) so detection anomalies auto-create incidents.**

### Acceptance Criteria

- [ ] `openeye watch --ticketing jira --jira-url https://corp.atlassian.net --jira-project SEC --jira-issue-type Incident` auto-creates Jira issues on detection anomalies
- [ ] `openeye watch --ticketing servicenow --snow-instance corp.service-now.com --snow-table incident` auto-creates ServiceNow incidents
- [ ] Ticket includes: summary (detection description), description (full context with camera, zone, timestamp, rule), priority (mapped from detection severity), attachment (frame snapshot)
- [ ] Priority mapping is configurable: `--priority-map critical:P1,high:P2,medium:P3,low:P4`
- [ ] Jira custom fields are supported: `--jira-fields '{"customfield_10001": "Security", "labels": ["openeye", "automated"]}'`
- [ ] ServiceNow fields are configurable: `--snow-fields '{"category": "Security", "subcategory": "Intrusion", "assignment_group": "SOC"}'`
- [ ] Ticket deduplication: if an identical anomaly (same rule, zone, label) already has an open ticket, a comment is added to the existing ticket instead of creating a duplicate
- [ ] Deduplication window is configurable: `--dedup-window 3600` (default: 1 hour) — after the window, a new ticket is created
- [ ] Ticket auto-resolution: if the anomaly clears (e.g., person leaves restricted zone), the ticket is auto-updated with a resolution comment and optionally transitioned to "Resolved" (`--auto-resolve`)
- [ ] Jira authentication: API token (`--jira-token`), OAuth 2.0, or PAT
- [ ] ServiceNow authentication: username/password, OAuth 2.0, or API key
- [ ] Ticket creation is rate-limited: `--max-tickets-per-hour 50` (default: 100) to prevent ticket storms
- [ ] Ticketing dependencies are optional: `pip install openeye-sh[jira]` installs `jira`; `pip install openeye-sh[servicenow]` installs `pysnow`

### Edge Cases

- [ ] Jira API rate limit (429): backs off using the `Retry-After` header. If rate-limited for >5 minutes, buffers ticket creation requests locally and retries
- [ ] ServiceNow instance maintenance mode: creation requests fail with 503 — retries with exponential backoff. Logs a warning about the instance being in maintenance
- [ ] Jira project doesn't exist or user lacks permissions: fails on startup with a clear error listing required permissions (`CREATE_ISSUES`, `ADD_COMMENTS`, `TRANSITION_ISSUES`)
- [ ] ServiceNow table doesn't exist: fails on startup with a clear error — does not silently drop incident data
- [ ] Frame snapshot too large for Jira attachment (default max: 10MB): auto-compresses the JPEG. If still too large, attaches a thumbnail with a link to the full-resolution snapshot in object storage (if configured)
- [ ] Ticket deduplication with Jira: searches for open issues with a unique `openeye_rule_hash` custom field. If the custom field doesn't exist and `--jira-auto-setup` is set, creates it; otherwise logs an error with setup instructions
- [ ] Ticket storm prevention: if `--max-tickets-per-hour` is reached, subsequent anomalies are logged locally and a single summary ticket is created at the end of the hour: "X additional anomalies detected — see attached log"
- [ ] Auto-resolve race condition: if the anomaly clears and re-triggers within seconds, the resolve-then-reopen sequence is coalesced — the ticket stays open with an updated comment rather than rapidly transitioning
- [ ] Jira workflow restrictions: if the "Resolved" transition requires mandatory fields (e.g., resolution type), `--auto-resolve` includes default values configurable via `--jira-resolve-fields`
- [ ] ServiceNow approval workflows: if the incident table requires approval, the auto-created incident is submitted for approval — the adapter does not attempt to auto-approve
- [ ] Unicode in detection labels or scene descriptions: properly encoded in both Jira (wiki markup) and ServiceNow (HTML) description fields
- [ ] Network partition: if ticketing API is unreachable for extended periods, buffered tickets are persisted to disk (`~/.openeye/ticket-buffer/`) and replayed on reconnection
- [ ] Jira Cloud vs Data Center API differences: diverging APIs — no mention of which deployment type supported or how differences handled
- [ ] OAuth2 token refresh during extended operation: token expiry mid-operation for both Jira and ServiceNow not addressed
- [ ] Ticket buffer disk exhaustion: `~/.openeye/ticket-buffer/` could fill disk during extended network outage — no max buffer size (unlike WAL in story 196)
- [ ] Sensitive detection data in tickets: frame snapshots and details could contain PII — no redaction before ticket creation

### Technical Notes

- Jira integration uses the `jira` Python library (REST API v3)
- ServiceNow integration uses `pysnow` or direct REST API calls
- Ticket logic lives in `cli/openeye_ai/integrations/jira.py` and `servicenow.py`
- Deduplication uses a SHA-256 hash of `(rule_name, zone_name, label)` stored as a custom field on the ticket
- Auto-resolve uses Jira's transition API and ServiceNow's state field update

---

## 199. Secrets Manager Integration

**As an enterprise developer, I can connect to our secrets manager (Vault, AWS Secrets Manager) for API key and credential management instead of env vars.**

### Acceptance Criteria

- [ ] `openeye serve --secrets vault --vault-addr https://vault.corp.com --vault-path secret/data/openeye` fetches configuration from HashiCorp Vault
- [ ] `openeye serve --secrets aws --aws-secret-name openeye/config --aws-region us-east-1` fetches from AWS Secrets Manager
- [ ] `openeye serve --secrets gcp --gcp-secret projects/my-project/secrets/openeye-config/versions/latest` fetches from Google Cloud Secret Manager
- [ ] `openeye serve --secrets azure --azure-vault-url https://openeye-vault.vault.azure.net --azure-secret openeye-config` fetches from Azure Key Vault
- [ ] Supported secret fields: `api_key`, `kafka_password`, `snowflake_private_key`, `jira_token`, `webhook_secrets`, database credentials, VMS credentials
- [ ] Secrets are resolved at startup and injected into the configuration — they override environment variables and CLI flags
- [ ] Secret references in config files: `api_key: vault:secret/data/openeye#api_key` or `api_key: aws:openeye/config#api_key` for field-level references
- [ ] Vault authentication methods: token (`--vault-token`), AppRole (`--vault-role-id --vault-secret-id`), Kubernetes service account (`--vault-k8s-role`), AWS IAM
- [ ] AWS Secrets Manager authentication: standard AWS credential chain (env, profile, IAM role, IRSA, ECS task role)
- [ ] GCP authentication: service account, workload identity, application default credentials
- [ ] Azure authentication: managed identity, service principal, Azure CLI credentials
- [ ] Secret rotation: `--secret-refresh-interval 300` (default: 0 / disabled) polls for updated secrets and hot-reloads them without restarting the server
- [ ] `openeye secrets test` validates connectivity and permissions to the configured secrets manager

### Edge Cases

- [ ] Vault is sealed: fails on startup with a clear error: "Vault is sealed. Unseal the vault or check your Vault admin." Does not fall back to env vars unless `--secrets-fallback env` is explicitly set
- [ ] AWS Secrets Manager throttled (`ThrottlingException`): retries with exponential backoff (up to 30s). If the secret cannot be fetched within `--secrets-timeout` (default: 30s), fails with a clear error
- [ ] Secret not found (404): fails on startup with the exact secret path that was not found — does not log the secret value
- [ ] Secret value is empty or malformed JSON: fails with a clear error showing which fields are missing or invalid — does not log the actual secret content
- [ ] Secret rotation during runtime: when `--secret-refresh-interval` detects a new version, the new secret is validated before replacing the old one. If the new secret is invalid, the old secret remains active and a warning is logged
- [ ] Vault lease expiry: if using dynamic secrets (e.g., database credentials from Vault), the adapter renews the lease before expiry. If renewal fails, logs an error and continues with the current credentials until they expire
- [ ] Multiple secrets managers: `--secrets vault,aws` can chain lookups — Vault is tried first, AWS as fallback. Useful for migration scenarios
- [ ] Secret caching: fetched secrets are cached in memory (never written to disk). The in-memory cache is cleared on process exit
- [ ] Permission denied: the error message includes which permission is missing (e.g., "Vault policy requires `read` capability on `secret/data/openeye`") without revealing the secret path structure beyond what's necessary
- [ ] Kubernetes Vault auth: if the service account token is expired or the pod is being terminated, the adapter detects this and logs a message about the token refresh cycle
- [ ] Audit trail: all secret access events (fetch, refresh, rotation) are logged at `info` level with the secret name (never the value) and the source
- [ ] `--secrets-fallback env` with `--secret-refresh-interval`: env vars are used initially but replaced when the secrets manager becomes available — useful for graceful degradation during secrets manager outages
- [ ] Vault namespace/multi-tenancy: Vault supports namespaces — no `--vault-namespace` or namespace-aware paths
- [ ] AppRole secret ID TTL expiry: secret_id TTL expires during long-running process — cannot re-authenticate to Vault
- [ ] Process core dump containing secrets: crash creates core dump with in-memory secrets — no `mlock`/`madvise` to prevent swap or core dump exposure
- [ ] Secret value encoding (binary vs string): AWS Secrets Manager supports both `SecretString` and `SecretBinary` — no binary secret support mentioned

### Technical Notes

- Vault integration uses the `hvac` Python library
- AWS Secrets Manager uses `boto3`
- GCP Secret Manager uses `google-cloud-secret-manager`
- Azure Key Vault uses `azure-keyvault-secrets` with `azure-identity`
- Secret resolution lives in `cli/openeye_ai/secrets/` with `vault.py`, `aws.py`, `gcp.py`, `azure.py`
- All providers implement a `SecretsProvider` interface: `get_secret(path, field) -> str`, `refresh()`, `close()`
- Dependencies are optional: `pip install openeye-sh[vault]`, `[aws-secrets]`, `[gcp-secrets]`, `[azure-secrets]`

---

## 200. OpenAPI Spec & Multi-Language SDK Clients

**As an enterprise developer, the platform provides a comprehensive OpenAPI spec and SDK clients (Python, Go, TypeScript, Java) so my team can integrate in any language.**

### Acceptance Criteria

- [ ] `openeye serve` exposes a complete OpenAPI 3.1 specification at `/openapi.json` covering all REST endpoints
- [ ] The OpenAPI spec includes: all request/response schemas, authentication schemes, error codes, example values, and pagination parameters
- [ ] OpenAPI spec is auto-generated from FastAPI's Pydantic models — always in sync with the actual API
- [ ] SDK clients are auto-generated from the OpenAPI spec using `openapi-generator`:
  - **Python**: `pip install openeye-sdk` — typed client with Pydantic models
  - **TypeScript**: `npm install @openeye/sdk` — typed client with TypeScript interfaces
  - **Go**: `go get github.com/openeye-sh/openeye-go` — idiomatic Go client with struct types
  - **Java**: `com.openeye:openeye-sdk` on Maven Central — Java client with POJO models
- [ ] Each SDK provides: `predict(image)`, `stream()`, `health()`, `models()`, `createWebhook()`, `listCameras()` methods
- [ ] SDKs support all authentication methods: API key (header), OAuth2 client credentials, and mTLS
- [ ] SDKs include automatic retry with exponential backoff for 5xx errors and rate-limit (429) responses
- [ ] SDKs include comprehensive inline documentation and code examples in each language
- [ ] TypeScript SDK supports both Node.js and browser environments (with WebSocket streaming via EventSource for SSE)
- [ ] Go SDK supports context cancellation for long-running streaming operations
- [ ] Java SDK provides both synchronous and async (CompletableFuture) variants
- [ ] SDK version is pinned to the API version: SDK v1.2.3 targets API v1.2.x — incompatible API changes bump the major SDK version
- [ ] `openeye serve --openapi-out spec.json` exports the OpenAPI spec to a file for offline SDK generation or API documentation hosting
- [ ] API changelog is embedded in the OpenAPI spec via `x-changelog` extension

### Edge Cases

- [ ] OpenAPI spec size: with all endpoints and schemas, the spec may exceed 500KB. `/openapi.json` supports `Accept-Encoding: gzip` and the response is cached with `ETag` for efficient client polling
- [ ] Breaking API changes: the OpenAPI spec includes `x-deprecated-at` and `x-sunset-at` dates for deprecated endpoints. SDKs log warnings when calling deprecated endpoints
- [ ] SDK generation for a new API version: CI pipeline generates, tests, and publishes all 4 SDKs automatically — no manual steps. If generation fails (e.g., unsupported OpenAPI feature), the CI pipeline blocks the API release
- [ ] SDK backward compatibility: clients using SDK v1.x can talk to API v1.y where y >= x. New optional response fields are ignored by older SDK versions (additionalProperties: true)
- [ ] TypeScript SDK in browser: `predict()` uses `fetch` with `FormData` for file upload. Streaming uses `EventSource` for SSE — WebSocket is not used in browser mode (firewall-friendly)
- [ ] Go SDK connection pooling: uses `http.Client` with configurable `MaxIdleConns` (default: 10) and `IdleConnTimeout` (default: 90s) for efficient connection reuse
- [ ] Java SDK thread safety: the client is thread-safe. Internal connection pool is managed by OkHttp with configurable pool size
- [ ] Python SDK vs Python client (story 85): the SDK (`openeye-sdk`) is a thin, auto-generated REST client with no `openeye-sh` dependency. The client (`openeye-sh.Client`) is a high-level wrapper that includes local model support. Both can be used independently
- [ ] API versioning: the OpenAPI spec is versioned at `/v1/openapi.json`. Future `/v2/` prefix is supported without breaking v1 clients
- [ ] Custom fields in webhooks/zones/cameras: the OpenAPI spec uses `additionalProperties` for extensible objects. SDKs expose these as `Map<String, Object>` (Java), `Record<string, unknown>` (TS), `map[string]interface{}` (Go), `Dict[str, Any]` (Python)
- [ ] Spec validation: CI runs `openapi-spec-validator` on every commit that changes an endpoint — invalid specs block the PR
- [ ] Rate limit headers: all responses include `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`. SDKs parse these headers and expose them via a `rate_limit_info` property on each response
- [ ] SDK retry on non-idempotent endpoints: retrying POST `createWebhook()` on 5xx could create duplicates — no idempotency key support
- [ ] SDK proxy configuration: enterprise environments use HTTP proxies — no `HTTPS_PROXY` support in any of the 4 SDKs
- [ ] Streaming endpoint SDK reconnection: SSE disconnections need auto-reconnect with `Last-Event-ID` — no back-pressure or reconnection in SDK
- [ ] SDK user-agent header: no `User-Agent` identifying SDK version/language — important for API analytics and debugging

### Technical Notes

- OpenAPI spec is generated by FastAPI from the Pydantic models in `schema.py` and the route definitions in `server/app.py`
- SDK generation uses `openapi-generator-cli` v7.x with language-specific templates customized in `sdk/templates/`
- SDK source code lives in `sdk/python/`, `sdk/typescript/`, `sdk/go/`, `sdk/java/`
- CI/CD pipeline: on API tag → generate spec → generate SDKs → run SDK integration tests → publish to package registries
- The Python SDK is distinct from the CLI `openeye_ai` package — it has minimal dependencies (just `httpx` and `pydantic`)
- Go SDK uses `net/http` stdlib (no external HTTP dependencies)
- Java SDK uses OkHttp 4.x and Jackson for JSON serialization

### Example Usage

```python
# Python SDK
from openeye_sdk import OpenEyeClient

client = OpenEyeClient(api_key="sk-...", base_url="https://api.openeye.example.com")
result = client.predict(open("photo.jpg", "rb"))
print(result.objects)
```

```typescript
// TypeScript SDK
import { OpenEyeClient } from '@openeye/sdk';

const client = new OpenEyeClient({ apiKey: 'sk-...', baseUrl: 'https://api.openeye.example.com' });
const result = await client.predict(imageBuffer);
console.log(result.objects);
```

```go
// Go SDK
package main

import (
    "context"
    "fmt"
    openeye "github.com/openeye-sh/openeye-go"
)

func main() {
    client := openeye.NewClient("sk-...", openeye.WithBaseURL("https://api.openeye.example.com"))
    result, _ := client.Predict(context.Background(), "photo.jpg")
    fmt.Println(result.Objects)
}
```

```java
// Java SDK
import com.openeye.sdk.OpenEyeClient;
import com.openeye.sdk.model.PredictionResult;

OpenEyeClient client = OpenEyeClient.builder()
    .apiKey("sk-...")
    .baseUrl("https://api.openeye.example.com")
    .build();
PredictionResult result = client.predict(new File("photo.jpg"));
System.out.println(result.getObjects());
```
