# Observability (159–170)

---

## 159. Structured Logging

**As a platform operator, I can rely on all OpenEye components emitting structured JSON logs with correlation IDs, severity levels, and contextual metadata for production debugging.**

### Acceptance Criteria

- [ ] All log output from `openeye serve`, `openeye watch`, and `openeye run` is emitted as newline-delimited JSON (NDJSON) when `--log-format json` is set (default for `serve`; default for `watch`/`run` is `text`)
- [ ] Each log line includes mandatory fields: `timestamp` (ISO 8601 UTC), `level` (DEBUG, INFO, WARN, ERROR, FATAL), `message`, `logger` (component name), `correlation_id` (UUID v4)
- [ ] A `correlation_id` is generated per API request in `openeye serve` and propagated through all downstream log entries for that request — extractable from the `X-Correlation-ID` response header
- [ ] Incoming requests that include an `X-Correlation-ID` header reuse that ID instead of generating a new one, enabling cross-service tracing
- [ ] Contextual metadata fields are included where applicable: `model` (model name), `source_id` (camera/input identifier), `inference_ms` (inference duration), `device` (cpu/cuda:0), `tenant_id` (enterprise multi-tenant)
- [ ] Log levels are configurable at startup via `--log-level` (default: `INFO`) and at runtime via `PUT /admin/log-level` (requires admin API key)
- [ ] Per-component log levels are supported: `--log-level inference=DEBUG,api=WARN,camera=INFO` for fine-grained control
- [ ] Sensitive data (API keys, credentials, bearer tokens) is automatically redacted from all log output — replaced with `[REDACTED]`
- [ ] Log rotation is configurable when writing to file: `--log-file /var/log/openeye/server.log --log-max-size 100MB --log-max-files 10`
- [ ] `openeye serve` logs request/response metadata (method, path, status code, latency, request size, response size) for every API call at INFO level
- [ ] Stack traces on ERROR/FATAL include the full Python traceback serialized as a single JSON field `stacktrace` (not multi-line)
- [ ] Log output supports writing to stdout, stderr, file, or syslog via `--log-output stdout` (default), `--log-output file:/path`, `--log-output syslog://localhost:514`
- [ ] A human-readable text format is available via `--log-format text` with colorized severity levels for local development

### Edge Cases

- [ ] If `--log-file` target directory does not exist, creates it with `mkdir -p` behavior and logs a warning about the auto-created directory
- [ ] If the log file becomes unwritable mid-operation (disk full, permissions changed), falls back to stderr and emits a `LOG_WRITE_FAILURE` warning every 60 seconds — does not crash the server
- [ ] Log entries with non-UTF-8 content (e.g., binary data in error context) are base64-encoded in the JSON field with a `_encoding: base64` sibling field
- [ ] Extremely long log messages (>64KB) are truncated to 64KB with a `truncated: true` field and the original length in `original_length`
- [ ] Concurrent log writes from multiple async workers are serialized — no interleaved partial JSON lines in the output
- [ ] If `X-Correlation-ID` from an incoming request is not a valid UUID, a new UUID is generated and the invalid value is logged at WARN level
- [ ] Log timestamps use monotonic clock ordering — even if the system clock is adjusted (NTP), log entries within a single process are never out of order
- [ ] `--log-level` accepts case-insensitive values (`debug`, `Debug`, `DEBUG` all work). Invalid level names fail with a clear error listing valid options
- [ ] When running in a container (detected via `/.dockerenv` or cgroup), `--log-format json` is auto-selected as the default to avoid ANSI escape codes in container log collectors
- [ ] Dynamic log level change via `PUT /admin/log-level` is audit-logged at WARN level (showing who changed it and from what level to what level) and resets to the startup level on process restart
- [ ] Log injection attacks: user-controlled input (camera names, source_id) embedded in JSON log fields could break downstream log parsers — sanitize or escape user-supplied values
- [ ] PII in error messages: stack traces may contain file paths, IP addresses, or inference input data (image URLs with tokens) — broader PII redaction needed beyond API keys
- [ ] Log volume during incident storms: tight reconnection loops or model exceptions could generate thousands of ERROR lines/second — no rate-limiting on log output

### Technical Notes

- Uses Python `structlog` library configured with JSON renderer for structured output and `ConsoleRenderer` for text output
- Logger is initialized in `cli/openeye_ai/logging.py` and imported across all modules
- Correlation ID is stored in a `contextvars.ContextVar` and automatically injected by `structlog` processors
- FastAPI middleware at `server/middleware.py` extracts/generates correlation IDs and attaches them to the request context
- Log schema aligns with the Elastic Common Schema (ECS) field naming conventions for compatibility with story 165

---

## 160. Prometheus Metrics

**As a platform operator, I can scrape Prometheus metrics from `openeye serve` to monitor inference performance, throughput, and resource utilization.**

### Acceptance Criteria

- [ ] `openeye serve` exposes a `/metrics` endpoint in Prometheus exposition format (text/plain; version=0.0.4)
- [ ] Histogram metric `openeye_inference_duration_seconds` tracks inference latency with buckets: 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0 — labeled by `model`, `device`, `status` (success/error)
- [ ] Counter metric `openeye_inference_total` counts total inference requests — labeled by `model`, `device`, `status`
- [ ] Counter metric `openeye_inference_errors_total` counts inference errors — labeled by `model`, `error_type` (timeout, oom, model_error, validation_error)
- [ ] Gauge metric `openeye_gpu_utilization_percent` reports current GPU utilization (0–100) — labeled by `device` (cuda:0, cuda:1, ...)
- [ ] Gauge metric `openeye_gpu_memory_used_bytes` and `openeye_gpu_memory_total_bytes` report GPU VRAM usage — labeled by `device`
- [ ] Gauge metric `openeye_queue_depth` reports the current number of queued inference requests
- [ ] Counter metric `openeye_frames_processed_total` counts total camera frames processed — labeled by `source_id`
- [ ] Counter metric `openeye_frames_dropped_total` counts frames dropped due to backpressure — labeled by `source_id`
- [ ] Gauge metric `openeye_model_loaded` is 1 when a model is loaded and ready, 0 otherwise — labeled by `model`, `version`
- [ ] Histogram metric `openeye_http_request_duration_seconds` tracks API request latency — labeled by `method`, `path`, `status_code`
- [ ] Summary metric `openeye_detection_confidence` tracks detection confidence distributions — labeled by `model`, `label`
- [ ] Gauge metric `openeye_active_connections` reports current WebSocket/SSE stream connections
- [ ] The `/metrics` endpoint is optionally protected by a separate `--metrics-api-key` to prevent unauthorized scraping
- [ ] Custom metric prefix is configurable via `--metrics-prefix` (default: `openeye`)

### Edge Cases

- [ ] If no GPU is available (CPU-only mode), `openeye_gpu_*` metrics are not registered — they do not appear in `/metrics` output with zero values, avoiding confusion
- [ ] If the GPU monitoring library (`pynvml`) is not installed, GPU metrics are omitted and a `openeye_gpu_monitoring_available` info metric is set to 0
- [ ] `/metrics` endpoint responds within 100ms even under heavy inference load — metric collection does not block the inference pipeline
- [ ] If the Prometheus scrape interval is shorter than metric update frequency (e.g., GPU utilization polled every 5s but scraped every 1s), stale values are served with the original timestamp — no synthetic interpolation
- [ ] High-cardinality labels: `label` dimension on `openeye_detection_confidence` is bounded to the top 100 most frequent labels. If exceeded, low-frequency labels are grouped under `_other` and a `openeye_metrics_label_overflow` counter is incremented
- [ ] Histogram bucket boundaries cannot be changed at runtime — they are fixed at startup. A restart is required to change buckets, which is documented in the metric description
- [ ] If two `openeye serve` instances run on the same host with different `--metrics-port` values, each has independent metric registries — no cross-contamination via the default Prometheus global registry
- [ ] `openeye_inference_duration_seconds` excludes image preprocessing time (decoding, resizing) — a separate `openeye_preprocessing_duration_seconds` histogram captures that
- [ ] When the model is being hot-swapped (story 163), `openeye_model_loaded` briefly shows 0 for the old model and then 1 for the new model — intermediate state is observable
- [ ] Counter metrics survive process restarts if `--metrics-persistence /var/lib/openeye/metrics` is set — uses a file-backed registry to resume counters. Without persistence, counters reset to 0 on restart (standard Prometheus behavior)
- [ ] Metric series churn on model version changes: each model version creates new label combinations — old series go stale but remain in TSDB until retention. Frequent iteration causes unbounded series growth
- [ ] `/metrics` endpoint authentication bypass: if `--metrics-api-key` is forgotten in production, metric data (GPU util, queue depth, error rates) is exposed to unauthenticated scrapers
- [ ] Label value sanitization: Prometheus label values have length limits in some backends (Cortex/Mimir) — user-supplied `source_id` with special characters could cause scrape failures

### Technical Notes

- Uses the `prometheus_client` Python library with a custom `CollectorRegistry` (not the global default)
- Metrics are registered in `cli/openeye_ai/metrics/prometheus.py`
- GPU metrics use `pynvml` (NVIDIA Management Library) polled in a background thread every 5 seconds
- The `/metrics` endpoint is mounted on the FastAPI app at `server/app.py` via `make_asgi_app()` from `prometheus_client`
- Metric naming follows Prometheus naming conventions: snake_case, unit suffix, `_total` for counters
- All metrics carry an `instance` label automatically added by Prometheus server config (not hardcoded)

### Example Scrape Config

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'openeye'
    scrape_interval: 15s
    static_configs:
      - targets: ['openeye-server:8000']
    metrics_path: /metrics
    bearer_token: '<metrics-api-key>'
```

---

## 161. Distributed Tracing (OpenTelemetry)

**As a platform operator, I can trace requests end-to-end from API ingress through model inference to response using OpenTelemetry, exportable to Jaeger, Zipkin, or Grafana Tempo.**

### Acceptance Criteria

- [ ] All `openeye serve` requests are instrumented with OpenTelemetry spans — each request creates a root span `openeye.http.request` with child spans for each processing stage
- [ ] Span hierarchy per inference request: `openeye.http.request` → `openeye.image.preprocess` → `openeye.model.inference` → `openeye.result.postprocess` → `openeye.response.serialize`
- [ ] Each span includes attributes: `openeye.model.name`, `openeye.model.version`, `openeye.device`, `openeye.image.width`, `openeye.image.height`, `openeye.detection.count`
- [ ] `openeye.model.inference` span includes `openeye.inference.duration_ms`, `openeye.inference.batch_size`, and `openeye.inference.precision` (fp16/fp32/int8) attributes
- [ ] Trace context propagation supports W3C TraceContext (`traceparent` header) and B3 (`X-B3-TraceId`) formats
- [ ] Traces are exported via OTLP (gRPC or HTTP) to a configurable endpoint: `--otel-endpoint http://tempo:4317` (gRPC) or `--otel-endpoint http://tempo:4318/v1/traces` (HTTP)
- [ ] Export format is configurable: `--otel-exporter otlp` (default), `--otel-exporter jaeger`, `--otel-exporter zipkin`, `--otel-exporter console` (for debugging)
- [ ] Sampling is configurable: `--otel-sampling-rate 0.1` (10% of requests, default: 1.0 / 100%) with support for parent-based sampling
- [ ] Resource attributes are auto-populated: `service.name=openeye`, `service.version=<version>`, `host.name`, `os.type`, `deployment.environment` (via `--otel-environment`)
- [ ] Camera/streaming operations in `openeye watch` emit spans for each frame: `openeye.frame.capture` → `openeye.frame.inference` → `openeye.frame.output`
- [ ] Span events are emitted for significant occurrences: `model.loaded`, `model.error`, `frame.dropped`, `gpu.oom`
- [ ] Baggage propagation: custom attributes set via `--otel-baggage "tenant=acme,region=us-west"` are propagated to all downstream spans
- [ ] `openeye serve` logs the trace ID in every structured log entry (story 159) as `trace_id` and `span_id` fields for log-trace correlation

### Edge Cases

- [ ] If the OTLP endpoint is unreachable, traces are buffered in memory (up to `--otel-max-queue-size`, default: 2048 spans) and retried with exponential backoff — inference is never blocked by trace export failures
- [ ] If the export queue overflows, oldest spans are dropped and `openeye_otel_spans_dropped_total` Prometheus counter (story 160) is incremented
- [ ] Extremely long inference (>30s timeout): the span is ended with status `ERROR` and a `timeout` event — partial trace data is still exported
- [ ] Batch inference (`/predict/batch`): the root span `openeye.http.request` has one child `openeye.model.inference` span per image in the batch, each with its own duration and detection count
- [ ] Span attribute values exceeding 4096 characters (e.g., verbose error messages) are truncated with a `truncated: true` attribute
- [ ] If both W3C and B3 headers are present in an incoming request, W3C takes precedence and B3 is ignored — logged at DEBUG level
- [ ] Console exporter (`--otel-exporter console`) pretty-prints spans to stderr with indentation showing the span hierarchy — useful for local development
- [ ] If `opentelemetry-api` is installed but `opentelemetry-sdk` is not, tracing is no-op (API stubs only) — no crash, no data. Logged at WARN level on startup
- [ ] gRPC export with mTLS: `--otel-tls-cert` and `--otel-tls-key` configure client certificates for the OTLP gRPC exporter
- [ ] Trace ID format: 128-bit hex string (32 characters) compatible with all major backends. Legacy 64-bit trace IDs from B3 headers are left-padded with zeros
- [ ] Tail-based sampling missing for errors: at 10% sampling, 90% of error traces are dropped — for debugging, error traces are most valuable. No "always sample on error" policy
- [ ] Trace storage cost for video streams: `openeye watch` at 30 FPS × 100 cameras = 3000 spans/sec — even at 10% sampling, 26M spans/day. No cost guidance
- [ ] Trace-log correlation gap during sampling: when trace is not sampled, `trace_id` in logs creates dangling references — operators search for nonexistent traces
- [ ] Sensitive data in span attributes: span attributes could contain file paths with usernames, S3 presigned URLs with credentials — no PII scrubbing processor for spans

### Technical Notes

- Uses `opentelemetry-api`, `opentelemetry-sdk`, `opentelemetry-exporter-otlp` Python packages
- Instrumentation lives in `cli/openeye_ai/tracing/otel.py` with auto-instrumentation for FastAPI via `opentelemetry-instrumentation-fastapi`
- Trace-log correlation: `structlog` processor (story 159) reads `trace_id` and `span_id` from the current OpenTelemetry context and injects them into log entries
- Optional dependency group: `pip install openeye-sh[tracing]`
- Span names follow OpenTelemetry semantic conventions where applicable (e.g., `http.request` prefix for HTTP spans)

---

## 162. Inference Performance Dashboard

**As a platform operator, I can import a Grafana dashboard that visualizes inference latency, throughput, GPU utilization, and model accuracy drift.**

### Acceptance Criteria

- [ ] A Grafana dashboard JSON file is shipped at `dashboards/grafana/openeye-inference-performance.json` and importable via Grafana's dashboard import UI or provisioning API
- [ ] Dashboard is compatible with Grafana 10.x+ and uses the Prometheus data source by default (data source name is configurable via a `DS_PROMETHEUS` variable)
- [ ] Panel: **Inference Latency** — time series showing P50, P95, P99 of `openeye_inference_duration_seconds` histogram with selectable model and device filters
- [ ] Panel: **Throughput (FPS)** — time series showing `rate(openeye_frames_processed_total[1m])` per source, with a total aggregate line
- [ ] Panel: **GPU Utilization** — time series showing `openeye_gpu_utilization_percent` per device, with a horizontal threshold line at 90% (warning) and 95% (critical)
- [ ] Panel: **GPU Memory Usage** — stacked area chart showing `openeye_gpu_memory_used_bytes` / `openeye_gpu_memory_total_bytes` per device, with percentage annotation
- [ ] Panel: **Inference Error Rate** — time series showing `rate(openeye_inference_errors_total[5m])` by `error_type`, with a target error rate SLO line (configurable via dashboard variable, default: 0.1%)
- [ ] Panel: **Queue Depth** — time series showing `openeye_queue_depth` with a max queue capacity horizontal line
- [ ] Panel: **Detection Confidence Distribution** — heatmap showing `openeye_detection_confidence` by label over time
- [ ] Panel: **Active Connections** — stat panel showing current `openeye_active_connections` (WebSocket + SSE)
- [ ] Panel: **Model Status** — table showing `openeye_model_loaded` with model name, version, device, and uptime since last load
- [ ] Panel: **Frames Dropped** — time series showing `rate(openeye_frames_dropped_total[1m])` per source, with zero as the expected baseline
- [ ] Panel: **HTTP Request Latency** — time series showing P50/P95/P99 of `openeye_http_request_duration_seconds` by endpoint path
- [ ] Panel: **Accuracy Drift** — time series showing `openeye_model_accuracy_score` (from story 163) with a rolling 24-hour average and threshold lines for acceptable drift
- [ ] Dashboard includes template variables: `$model` (multi-select), `$device` (multi-select), `$source_id` (multi-select), `$interval` (auto/1m/5m/15m/1h)
- [ ] Dashboard auto-refreshes every 30 seconds by default, configurable via Grafana's refresh interval dropdown

### Edge Cases

- [ ] If the Prometheus data source is named differently than `Prometheus`, the `DS_PROMETHEUS` variable allows remapping without editing the JSON — all panels reference `${DS_PROMETHEUS}`
- [ ] If no GPU metrics are available (CPU-only deployment), GPU panels show "No data" with an annotation explaining that GPU metrics require `pynvml` — panels do not error out
- [ ] Dashboard import into Grafana <10.0: gracefully degrades — newer panel types (e.g., flame graph) fall back to table view. A `min_grafana_version` annotation is included in the JSON metadata
- [ ] If multiple `openeye serve` instances report to the same Prometheus, the dashboard aggregates by instance via the `instance` label — each panel supports filtering by `$instance` variable
- [ ] Time range exceeding metric retention period: panels show "No data" for the out-of-retention range without errors — Grafana handles this natively but the dashboard's default time range is set to "Last 6 hours" to avoid empty states on first load
- [ ] Dashboard with >20 panels: lazy loading is enabled (`"loading": "lazy"`) on non-critical panels (Detection Confidence, Frames Dropped) to reduce initial render time
- [ ] If `openeye_model_accuracy_score` (story 163) is not being reported, the Accuracy Drift panel shows "No data — enable accuracy monitoring (story 163)" as an annotation
- [ ] Panel queries use `$__rate_interval` instead of hardcoded intervals for correct rate calculation regardless of scrape interval
- [ ] Dashboard JSON uses relative time (`now-6h to now`) not absolute timestamps, so it works on import without time zone adjustments
- [ ] Color thresholds on GPU Utilization panel use Grafana's native threshold feature: green (<70%), yellow (70–90%), red (>90%)
- [ ] Dashboard showing stale data after Prometheus restart: counter resets cause `rate()` to produce negative spikes — no `resets()` annotations or counter reset handling
- [ ] Dashboard variable query performance: with 1000+ cameras, label value queries are slow and can timeout — dashboard fails to load
- [ ] Dashboard JSON drift from metric name changes: if metric names are modified, panels silently show "No data" — no validation script checking queries against registered metrics

### Technical Notes

- Dashboard JSON follows Grafana's dashboard model schema and is tested against Grafana 10.x and 11.x
- Each panel uses PromQL queries referencing the metric names defined in story 160
- Dashboard is also available as a Grafana Helm chart values snippet for Kubernetes deployments: `dashboards/grafana/helm-values.yaml`
- Dashboard ID and UID are deterministic (`openeye-inference-performance`) for idempotent provisioning
- A Grafana provisioning config file is included at `dashboards/grafana/provisioning.yaml` for automated deployment

---

## 163. Model Accuracy Monitoring

**As a platform operator, I can continuously monitor production model accuracy by comparing predictions against ground truth or reference datasets to detect accuracy drift.**

### Acceptance Criteria

- [ ] `openeye serve --accuracy-monitor --ground-truth /data/ground-truth/` enables continuous accuracy monitoring by comparing predictions against a labeled ground truth dataset
- [ ] Ground truth format supports COCO JSON, Label Studio JSON, and CVAT XML (same formats as export in story 89)
- [ ] Gauge metric `openeye_model_accuracy_score` reports the current accuracy score (0.0–1.0) — labeled by `model`, `metric_type` (mAP, precision, recall, f1)
- [ ] Gauge metric `openeye_model_accuracy_map50` reports mean Average Precision at IoU 0.5 — labeled by `model`
- [ ] Gauge metric `openeye_model_accuracy_map50_95` reports mAP at IoU 0.5:0.95 — labeled by `model`
- [ ] Per-class accuracy is tracked: `openeye_model_accuracy_per_class` gauge — labeled by `model`, `label`, `metric_type`
- [ ] Accuracy evaluation runs on a configurable schedule: `--accuracy-eval-interval 3600` (default: every 1 hour) using a random sample of `--accuracy-sample-size 500` images from the ground truth set
- [ ] Shadow evaluation mode: `--accuracy-shadow-model yolov8-v2` runs a second model in parallel on the same inputs and compares both models' accuracy — results reported as `openeye_model_accuracy_score{model="yolov8-v2", role="shadow"}`
- [ ] Drift detection: when accuracy drops below `--accuracy-threshold 0.85` (mAP@50), a `openeye_model_accuracy_drift` gauge is set to 1 and a structured log entry is emitted at WARN level with drift details
- [ ] Accuracy results are logged as structured JSON (story 159) with `correlation_id`, `model`, `eval_timestamp`, `sample_size`, and per-metric scores
- [ ] `openeye accuracy report --model yolov8 --ground-truth /data/gt/ --output report.json` generates an on-demand accuracy report without running the server
- [ ] Confusion matrix data is exposed via `GET /admin/accuracy/confusion-matrix` as a JSON response for integration with external dashboards
- [ ] Historical accuracy scores are stored locally in `~/.openeye/accuracy-history.jsonl` for trend analysis

### Edge Cases

- [ ] Ground truth dataset with missing images (referenced in annotation but file not found): skips the missing image, logs a warning with the file path, and includes `images_skipped` count in the evaluation report
- [ ] Ground truth labels that don't match model output labels (e.g., GT uses "automobile" but model predicts "car"): supports a label mapping file `--label-map label_map.yaml` (e.g., `automobile: car`). Unmapped labels are logged as `label_mismatch` and excluded from accuracy calculation
- [ ] Ground truth with zero annotations for a class: per-class accuracy for that class reports `null` (not 0.0) with a `no_ground_truth_samples` flag
- [ ] Accuracy evaluation on a large ground truth set (>10,000 images) runs in a background thread and does not block inference — a `openeye_accuracy_eval_running` gauge is set to 1 during evaluation
- [ ] If the ground truth directory is modified (new images added, annotations updated) between evaluation cycles, the next evaluation picks up changes automatically — no restart required
- [ ] Shadow model fails to load (incompatible architecture, OOM): primary model inference continues unaffected. Shadow evaluation is disabled with a WARN log and `openeye_model_accuracy_score{role="shadow"}` reports `NaN`
- [ ] IoU threshold edge case: detections that exactly overlap a ground truth bbox at the IoU boundary (e.g., IoU = 0.500000) are counted as true positives (inclusive boundary)
- [ ] Accuracy score oscillation (alternating above/below threshold each cycle): drift alert uses a `--accuracy-drift-window 3` parameter requiring N consecutive below-threshold evaluations before firing, to avoid alert fatigue
- [ ] Extremely small ground truth sets (<50 images): accuracy scores are reported with a `low_sample_warning: true` attribute and confidence intervals are included in the log output
- [ ] Concurrent accuracy evaluations (triggered manually via API while scheduled evaluation is running): the manual request is queued and runs after the scheduled one completes — does not run two evaluations simultaneously
- [ ] Model hot-swap during accuracy evaluation: the evaluation completes with the model that was loaded at evaluation start. The next scheduled evaluation uses the new model
- [ ] Ground truth data corruption: corrupted COCO JSON could crash evaluation — no schema validation for ground truth files beyond format detection
- [ ] Accuracy history file growth unbounded: `~/.openeye/accuracy-history.jsonl` grows indefinitely with hourly evaluations — no rotation or retention limits
- [ ] Accuracy score NaN propagation: if evaluation produces NaN (division by zero), Prometheus gauge NaN breaks PromQL queries, SLO calculations (story 166), and dashboard panels

### Technical Notes

- Accuracy evaluation logic lives in `cli/openeye_ai/monitoring/accuracy.py`
- Uses `pycocotools` for mAP calculation (COCO evaluation protocol)
- Ground truth loading supports the same parsers as the annotation export (story 89) in reverse
- Shadow model evaluation reuses the same image preprocessing pipeline — only the model inference step is duplicated
- Accuracy history is queryable via `openeye accuracy history --model yolov8 --last 30d`
- Drift detection integrates with alerting (story 164) for automated notifications

---

## 164. Alerting & On-Call Integration (PagerDuty / OpsGenie)

**As a platform operator, I can configure alerts that fire to PagerDuty, OpsGenie, or Slack when SLOs are breached or critical errors occur.**

### Acceptance Criteria

- [ ] Alert rules are defined in a YAML configuration file: `openeye serve --alert-config alerts.yaml`
- [ ] Supported alert destinations: PagerDuty (Events API v2), OpsGenie (Alert API), Slack (Incoming Webhooks), and generic webhook (POST)
- [ ] Built-in alert rules (enabled by default, thresholds configurable):
  - `inference_latency_high`: fires when P99 of `openeye_inference_duration_seconds` exceeds threshold (default: 1s) for 5 minutes
  - `error_rate_high`: fires when `rate(openeye_inference_errors_total[5m])` / `rate(openeye_inference_total[5m])` exceeds threshold (default: 5%)
  - `gpu_utilization_critical`: fires when `openeye_gpu_utilization_percent` exceeds 95% for 10 minutes
  - `gpu_memory_exhausted`: fires when `openeye_gpu_memory_used_bytes` / `openeye_gpu_memory_total_bytes` exceeds 95%
  - `model_accuracy_drift`: fires when `openeye_model_accuracy_drift` (story 163) is 1 for consecutive evaluations
  - `queue_depth_critical`: fires when `openeye_queue_depth` exceeds 80% of max queue capacity for 5 minutes
- [ ] Each alert includes: severity (critical/warning/info), summary, description with current metric value vs threshold, affected model/device, runbook URL (configurable)
- [ ] PagerDuty integration: creates incidents with `routing_key`, `severity`, `summary`, `source`, `component`, and `custom_details` fields
- [ ] OpsGenie integration: creates alerts with `apiKey`, `message`, `priority` (P1–P5), `tags`, `details`, and `responders`
- [ ] Slack integration: posts formatted messages with color-coded severity (red=critical, orange=warning, blue=info), metric charts (via Grafana panel URL), and action buttons
- [ ] Alert deduplication: identical alerts within `--alert-dedup-window` (default: 15 minutes) are suppressed — only the first alert fires, subsequent occurrences are counted
- [ ] Alert auto-resolution: when the triggering condition clears, a resolution notification is sent to the same destination — PagerDuty resolves the incident, OpsGenie closes the alert, Slack posts an "all clear" message
- [ ] Alert routing: different rules can route to different destinations — e.g., critical alerts to PagerDuty, warnings to Slack
- [ ] `openeye alerts test --config alerts.yaml` sends a test alert to all configured destinations on startup
- [ ] Alert history is logged to `~/.openeye/alert-history.jsonl` with firing time, resolution time, duration, and destination

### Edge Cases

- [ ] PagerDuty API rate limit (120 events/min): alerts are queued and sent within rate limits. If the queue exceeds 1000 pending alerts, oldest alerts are dropped with a local log entry
- [ ] OpsGenie heartbeat expiry: if `--opsgenie-heartbeat` is configured, the adapter sends periodic heartbeats. If OpenEye crashes without sending a close heartbeat, OpsGenie detects the missing heartbeat and fires its own alert
- [ ] Slack webhook returns 403 (token revoked): logs the error with instructions to regenerate the webhook URL — does not retry (unlike 5xx which retries)
- [ ] Alert flapping: if an alert fires and resolves more than `--alert-flap-threshold` (default: 3) times within `--alert-flap-window` (default: 30 minutes), the alert enters a `flapping` state. A single "flapping alert" notification is sent, and further fires/resolves are suppressed until the metric stabilizes
- [ ] Multiple alert destinations for the same rule: if PagerDuty delivery succeeds but Slack fails, the failure is logged but does not block — each destination is independent
- [ ] Alert during `openeye serve` shutdown: in-flight alerts are flushed (with a 5-second timeout) before the process exits. Pending alert resolutions are sent immediately
- [ ] Clock skew between OpenEye and the alerting backend: alert timestamps use the local server clock. If PagerDuty/OpsGenie reject a timestamp as too far in the future/past, the timestamp is omitted and the backend's receive time is used
- [ ] Empty alert config file: `openeye serve --alert-config alerts.yaml` with an empty YAML file disables all alerts (including built-in defaults) — logged at WARN level
- [ ] Alert config YAML validation: malformed rules are rejected at startup with line-number-specific error messages. Valid rules in the same file still load
- [ ] PagerDuty dedup_key: uses a SHA-256 hash of `(rule_name, model, device)` as the deduplication key so PagerDuty correctly groups related events into a single incident
- [ ] Network partition lasting >1 hour: buffered alerts are persisted to `~/.openeye/alert-buffer.jsonl` and replayed when connectivity is restored — maximum buffer size is `--alert-buffer-max 500`
- [ ] Circular dependency — alerting depends on failing metrics: if Prometheus registry becomes corrupted or metrics thread dies, alert engine sees stale values — no self-monitoring of alert engine health
- [ ] Alert fatigue from correlated failures: single root cause (GPU crash) triggers 5+ alerts simultaneously — no grouping, correlation, or root-cause deduplication across rules
- [ ] Alert evaluation thread crash: unhandled exception silently stops all alerting — no watchdog or self-healing mechanism

### Technical Notes

- Alert engine lives in `cli/openeye_ai/alerting/engine.py` with destination adapters in `pagerduty.py`, `opsgenie.py`, `slack.py`, `webhook.py`
- Alert evaluation runs in a background thread every `--alert-eval-interval` (default: 30 seconds)
- Metric values for alert evaluation are read directly from the in-process Prometheus registry (story 160), not via HTTP scrape
- PagerDuty uses the Events API v2 (`https://events.pagerduty.com/v2/enqueue`)
- OpsGenie uses the REST API v2 (`https://api.opsgenie.com/v2/alerts`)
- Slack uses Incoming Webhooks with Block Kit message formatting
- Dependencies are optional: `pip install openeye-sh[alerting]` (pulls in `httpx` for async delivery)

### Example Config

```yaml
# alerts.yaml
destinations:
  pagerduty:
    routing_key: ${PAGERDUTY_ROUTING_KEY}
    severity_map:
      critical: critical
      warning: warning
      info: info

  slack:
    webhook_url: ${SLACK_WEBHOOK_URL}
    channel: "#openeye-alerts"
    grafana_base_url: https://grafana.corp.com

rules:
  - name: inference_latency_high
    metric: openeye_inference_duration_seconds_p99
    condition: "> 1.0"
    for: 5m
    severity: critical
    destinations: [pagerduty, slack]
    runbook: https://wiki.corp.com/openeye/runbooks/high-latency

  - name: accuracy_drift
    metric: openeye_model_accuracy_drift
    condition: "== 1"
    for: 0m
    severity: warning
    destinations: [slack]
    runbook: https://wiki.corp.com/openeye/runbooks/accuracy-drift

  - name: gpu_memory_exhausted
    metric: openeye_gpu_memory_used_bytes / openeye_gpu_memory_total_bytes
    condition: "> 0.95"
    for: 2m
    severity: critical
    destinations: [pagerduty, slack]
```

---

## 165. Log Aggregation (ELK / Loki)

**As a platform operator, I can ship structured logs to Elasticsearch, Grafana Loki, or AWS CloudWatch for centralized search and analysis.**

### Acceptance Criteria

- [ ] `openeye serve --log-sink elasticsearch --es-url https://es.corp.com:9200 --es-index openeye-logs` ships structured JSON logs (story 159) to Elasticsearch
- [ ] `openeye serve --log-sink loki --loki-url http://loki:3100/loki/api/v1/push` ships logs to Grafana Loki
- [ ] `openeye serve --log-sink cloudwatch --cw-log-group /openeye/serve --cw-region us-east-1` ships logs to AWS CloudWatch Logs
- [ ] Elasticsearch sink creates an index template `openeye-logs-*` with daily rollover (`openeye-logs-2026.03.15`) and field mappings matching the structured log schema (story 159)
- [ ] Loki sink uses structured metadata labels: `job=openeye`, `level`, `component` (logger name), `model`, `source_id` — log line is the full JSON entry
- [ ] CloudWatch sink creates a log group and log stream per instance: `openeye-serve-<instance-id>`
- [ ] All sinks support buffered batch delivery: `--log-sink-batch-size 100 --log-sink-flush-interval 5s` for throughput optimization
- [ ] Elasticsearch authentication: API key (`--es-api-key`), username/password (`--es-user --es-password`), or AWS Signature v4 for OpenSearch
- [ ] Loki authentication: bearer token (`--loki-token`), basic auth (`--loki-user --loki-password`), or tenant ID header (`--loki-tenant`)
- [ ] CloudWatch authentication: standard AWS credential chain (env, profile, IAM role, IRSA)
- [ ] Multiple sinks can run simultaneously: `--log-sink elasticsearch,loki` ships to both destinations independently
- [ ] Each sink has independent retry logic with exponential backoff — failure in one sink does not affect others or the primary log output (stdout/file)
- [ ] Logs are enriched with infrastructure metadata before shipping: `hostname`, `container_id` (if running in Docker), `k8s_pod` (if running in Kubernetes, via downward API env vars)

### Edge Cases

- [ ] Elasticsearch cluster is red/unavailable: logs are buffered in memory up to `--log-sink-buffer-max` (default: 10,000 entries). If the buffer fills, oldest entries are dropped and a `openeye_log_sink_entries_dropped_total` Prometheus counter (story 160) is incremented
- [ ] Elasticsearch index mapping conflict (field type mismatch after schema change): the sink detects the `mapper_parsing_exception`, logs the conflicting field, and drops the problematic log entry — remaining entries are unaffected
- [ ] Loki rate limiting (429): backs off using `Retry-After` header. If sustained for >5 minutes, reduces label cardinality by dropping `source_id` label (highest cardinality) and logging a warning
- [ ] Loki label values exceeding 1024 bytes: truncated to 1024 bytes with `...` suffix — Loki rejects entries with oversized labels
- [ ] CloudWatch `ResourceNotFoundException` (log group deleted while running): re-creates the log group and log stream, then resumes shipping — logged at WARN level
- [ ] CloudWatch sequence token management: uses the `PutLogEvents` API with correct sequence tokens, handling `InvalidSequenceTokenException` by fetching the expected token and retrying
- [ ] Log entries with timestamps older than Elasticsearch's ILM retention policy: the entry is indexed but immediately eligible for deletion — not an error, but may cause confusion if logs arrive out of order
- [ ] Network partition during batch flush: the failed batch is retained in the buffer and retried on next flush cycle — no duplicate entries due to idempotent write semantics (Elasticsearch uses `_id` derived from `correlation_id` + `timestamp`)
- [ ] High log volume (>10,000 entries/sec): sinks automatically increase batch size and flush interval to avoid overwhelming the destination — adaptive batching with a ceiling of `--log-sink-max-batch-size` (default: 5000)
- [ ] Structured log fields with dots in names (e.g., `http.method`): Elasticsearch maps these as nested objects. If the user prefers flat field names, `--es-dot-notation flat` replaces dots with underscores before indexing
- [ ] Elasticsearch index lifecycle management (ILM): the sink creates an ILM policy `openeye-logs-policy` with configurable hot/warm/delete phases (`--es-retention-days`, default: 30)
- [ ] Graceful shutdown: all buffered log entries are flushed (with a `--shutdown-timeout` deadline) before the process exits — unflushed count is logged to stderr
- [ ] Loki label cardinality explosion: using `source_id` as Loki label with 1000+ cameras creates too many streams — Loki not designed for high-cardinality labels
- [ ] PII in logs shipped to external sinks: logs may contain tenant data, camera identifiers, IP addresses — no PII filtering specific to external sinks
- [ ] Log retention cost explosion: video streams generating thousands of entries/sec — 30-day retention could cost significant storage with no volume estimation

### Technical Notes

- Elasticsearch sink uses the `elasticsearch` Python client with bulk API for batch indexing
- Loki sink uses HTTP POST to `/loki/api/v1/push` with protobuf or JSON encoding
- CloudWatch sink uses `boto3` `logs` client with `put_log_events` API
- Sink logic lives in `cli/openeye_ai/logging/sinks/` with `elasticsearch.py`, `loki.py`, `cloudwatch.py`
- All sinks implement a `LogSink` interface: `emit(log_entry)`, `flush()`, `close()`
- Dependencies are optional: `pip install openeye-sh[elasticsearch]`, `[loki]`, `[cloudwatch]`
- Log schema in Elasticsearch follows the Elastic Common Schema (ECS) for native Kibana integration

---

## 166. Custom Metrics & SLIs/SLOs

**As an enterprise operator, I can define custom Service Level Indicators (SLIs) and Service Level Objectives (SLOs) with error budgets and burn-rate alerts.**

### Acceptance Criteria

- [ ] SLO definitions are declared in a YAML configuration file: `openeye serve --slo-config slos.yaml`
- [ ] Each SLO definition includes: `name`, `description`, `sli` (metric expression), `target` (e.g., 99.9%), `window` (rolling window, e.g., 30d), and `burn_rate_alerts` (multi-window burn-rate thresholds)
- [ ] Built-in SLI: `openeye_sli_inference_latency_p99` — derived from `openeye_inference_duration_seconds` histogram (story 160), represents the percentage of requests with P99 latency below a threshold
- [ ] Built-in SLI: `openeye_sli_availability` — derived from `openeye_inference_total` and `openeye_inference_errors_total`, represents the percentage of successful inferences
- [ ] Built-in SLI: `openeye_sli_throughput` — derived from `openeye_frames_processed_total`, represents frames processed per second as a percentage of target FPS
- [ ] Custom SLIs are defined via PromQL-like expressions in the SLO config: `sli: "sum(rate(openeye_inference_total{status='success'}[5m])) / sum(rate(openeye_inference_total[5m]))"`
- [ ] Gauge metric `openeye_slo_error_budget_remaining` reports the remaining error budget (0.0–1.0) — labeled by `slo_name`, `window`
- [ ] Gauge metric `openeye_slo_burn_rate` reports the current burn rate — labeled by `slo_name`, `window` (1h, 6h, 24h, 30d)
- [ ] Multi-window burn-rate alerts: configurable fast-burn (e.g., 14.4x burn rate over 1h and 6h) and slow-burn (e.g., 3x burn rate over 24h and 3d) thresholds per the Google SRE workbook methodology
- [ ] Burn-rate alerts integrate with the alerting system (story 164): fires PagerDuty/OpsGenie/Slack alerts when burn-rate thresholds are breached
- [ ] `GET /admin/slos` returns a JSON summary of all SLOs with current SLI value, error budget remaining, burn rate, and compliance status
- [ ] `openeye slo status` CLI command prints a formatted table of all SLOs with traffic-light status (green/yellow/red)
- [ ] Custom metrics can be registered at runtime via `POST /admin/metrics` with a JSON payload defining metric name, type (counter/gauge/histogram), labels, and help text
- [ ] SLO compliance history is stored in `~/.openeye/slo-history.jsonl` for trend analysis and SLO review meetings
- [ ] Grafana dashboard extension: an additional dashboard panel set `dashboards/grafana/openeye-slo-overview.json` visualizes SLO compliance, error budgets, and burn rates (extends story 162)

### Edge Cases

- [ ] SLO window start (first 30 days of deployment): error budget is prorated — a 30-day SLO with 99.9% target on day 1 has a proportionally smaller error budget. The `openeye_slo_error_budget_remaining` metric accounts for the shorter window
- [ ] Zero traffic periods (e.g., overnight, maintenance): SLI is undefined when denominator is 0 — `openeye_slo_error_budget_remaining` remains at its last known value and `openeye_slo_burn_rate` reports 0
- [ ] SLO config reload: `PUT /admin/slos/reload` hot-reloads the SLO config without restarting the server — new SLOs start with a full error budget, modified SLOs retain accumulated data, removed SLOs stop reporting
- [ ] Conflicting SLO names in the config file: rejected at startup with a clear error listing the duplicate names
- [ ] Custom metric name collision with built-in metrics: `POST /admin/metrics` rejects metric names starting with `openeye_` — returns 409 with a message about the reserved prefix
- [ ] PromQL expression syntax error in custom SLI: rejected at config load time with the specific parse error and line number in the YAML
- [ ] Error budget exhausted (remaining = 0): an `openeye_slo_budget_exhausted` alert (severity: critical) fires immediately — any further errors are in SLO violation
- [ ] Burn rate calculation with sparse data (few requests/minute): uses a minimum sample size (`--slo-min-samples`, default: 100) before burn rate is considered meaningful. Below this threshold, burn rate alerts are suppressed
- [ ] SLO window rollover (e.g., monthly reset): when `--slo-window-type calendar` is set, error budgets reset at the start of each calendar month. Default (`rolling`) uses a sliding window
- [ ] Custom metrics registered via API survive process restarts only if `--metrics-persistence` (story 160) is configured — otherwise they must be re-registered on startup via the config file
- [ ] SLO error budget exhaustion + burn rate alert storm: when budget hits zero, budget alert fires while burn-rate alerts continue redundantly — no suppression
- [ ] Counter reset impact on SLI computation: process restarts reset counters mid-window — SLI calculation produces incorrect results until sufficient post-restart data
- [ ] Multi-instance SLO aggregation missing: each instance computes SLI/SLO independently — fleet aggregate across all instances not computed

### Technical Notes

- SLO engine lives in `cli/openeye_ai/slo/engine.py` with SLI computation in `sli.py`
- Burn-rate calculation follows the multi-window multi-burn-rate methodology from the Google SRE Workbook (Chapter 5: Alerting on SLOs)
- SLO metrics are registered in the same Prometheus registry as story 160 metrics
- Custom metric registration API uses the `prometheus_client` library to dynamically create metric objects
- Error budget formula: `budget = 1.0 - (1.0 - actual_sli) / (1.0 - target_sli)` — e.g., 99.85% actual vs 99.9% target = 50% budget consumed
- SLO compliance calculation runs in a background thread every `--slo-eval-interval` (default: 60 seconds)
- The SLO Grafana dashboard uses recording rules or the in-process calculated metrics — no external rule engine required

### Example Config

```yaml
# slos.yaml
slos:
  - name: inference-availability
    description: "Inference requests succeed without errors"
    sli: |
      sum(rate(openeye_inference_total{status="success"}[5m]))
      /
      sum(rate(openeye_inference_total[5m]))
    target: 0.999  # 99.9%
    window: 30d
    burn_rate_alerts:
      - name: fast-burn
        burn_rate: 14.4
        short_window: 1h
        long_window: 6h
        severity: critical
        destinations: [pagerduty]
      - name: slow-burn
        burn_rate: 3.0
        short_window: 24h
        long_window: 3d
        severity: warning
        destinations: [slack]

  - name: inference-latency
    description: "P99 inference latency under 100ms"
    sli: |
      sum(rate(openeye_inference_duration_seconds_bucket{le="0.1"}[5m]))
      /
      sum(rate(openeye_inference_duration_seconds_count[5m]))
    target: 0.99  # 99%
    window: 7d
    burn_rate_alerts:
      - name: fast-burn
        burn_rate: 14.4
        short_window: 1h
        long_window: 6h
        severity: critical
        destinations: [pagerduty, slack]
```

---

## 167. Resource Utilization Tracking

**As a platform operator, I can track per-device and per-tenant resource utilization (CPU, GPU, memory, disk, bandwidth) for capacity planning and cost attribution.**

### Acceptance Criteria

- [ ] Gauge metric `openeye_cpu_utilization_percent` reports process-level CPU usage — labeled by `instance`
- [ ] Gauge metric `openeye_memory_used_bytes` and `openeye_memory_rss_bytes` report process memory (virtual and resident) — labeled by `instance`
- [ ] Gauge metric `openeye_disk_used_bytes` reports disk usage of the OpenEye data directory (`~/.openeye/`) — labeled by `instance`, `path`
- [ ] Gauge metric `openeye_network_bytes_sent_total` and `openeye_network_bytes_received_total` report cumulative network I/O — labeled by `instance`, `interface`
- [ ] All resource metrics are available per-tenant in multi-tenant deployments: `openeye_gpu_utilization_percent{tenant_id="acme"}` when `--multi-tenant` is enabled
- [ ] Per-model resource tracking: `openeye_model_gpu_memory_bytes{model="yolov8"}` reports GPU memory allocated per loaded model
- [ ] Per-source resource tracking: `openeye_source_bandwidth_bytes_total{source_id="camera-01"}` reports bandwidth consumed per camera input
- [ ] `openeye status` CLI command prints a formatted table showing current CPU, GPU, memory, disk, and network utilization with color-coded thresholds
- [ ] `GET /admin/resources` returns a JSON snapshot of all resource metrics with current values and 5-minute averages
- [ ] Resource utilization history is stored in a local RRD-style database (`~/.openeye/resource-history.db`) with 1-minute granularity for 24 hours and 1-hour granularity for 30 days
- [ ] Resource alerting thresholds integrate with story 164: `openeye_cpu_utilization_percent > 90%` for 10 minutes triggers a warning alert
- [ ] Disk usage monitoring includes model cache size, log files, WAL files (story 196), and accuracy history (story 163) — each reported as a separate `path` label value
- [ ] `openeye serve --resource-poll-interval 5` (default: 10 seconds) configures how often resource metrics are sampled

### Edge Cases

- [ ] Container environment (Docker/K8s): CPU and memory metrics respect cgroup limits — reports utilization relative to the container's allocated resources, not the host's total resources
- [ ] Multi-GPU systems: each GPU is tracked independently. If a GPU is exclusively allocated to a tenant, `tenant_id` label is set; shared GPUs report `tenant_id="shared"`
- [ ] Disk usage calculation on NFS/network mounts: `openeye_disk_used_bytes` may be slow on network filesystems — uses a cached value updated every `--disk-poll-interval` (default: 60 seconds) to avoid I/O stalls
- [ ] Process memory reporting with memory-mapped files (model weights): `openeye_memory_rss_bytes` includes mmap'd model files which may inflate the apparent memory usage — a separate `openeye_memory_model_mmap_bytes` metric reports mmap'd memory for clarity
- [ ] Network interface detection: on systems with many interfaces (Docker bridge, VPN, etc.), `--resource-network-interface eth0` filters to specific interfaces. Default: auto-detect the primary interface based on default route
- [ ] Tenant isolation in GPU memory: if NVIDIA MPS (Multi-Process Service) or MIG (Multi-Instance GPU) is configured, per-tenant GPU memory is accurate. Without MPS/MIG, per-tenant GPU memory is estimated based on model size and is approximate — a `gpu_isolation: none|mps|mig` attribute indicates the isolation level
- [ ] CPU utilization spike during model loading: `openeye_cpu_utilization_percent` may briefly report >100% (multi-core) — the metric is not capped; per-core breakdown is available via `openeye_cpu_utilization_per_core_percent{core="0"}`
- [ ] Disk space running low (<1GB remaining): a `openeye_disk_space_critical` alert fires (story 164) and a structured log at ERROR level is emitted with the remaining space and top-5 largest files in `~/.openeye/`
- [ ] `openeye status` on a headless server without TTY: outputs plain text without ANSI colors — auto-detected via `isatty()` check
- [ ] Resource history database corruption: if `resource-history.db` is corrupted, it is renamed to `resource-history.db.corrupt.<timestamp>` and a new database is created — no crash
- [ ] Per-tenant CPU attribution inaccuracy: in shared process, CPU attribution is inherently imprecise (context switching, GIL contention) — needs disclaimer similar to GPU estimation
- [ ] Network metric inaccuracy in K8s with service mesh: `psutil.net_io_counters` includes sidecar overhead (mTLS, health checks) — inflates application bandwidth
- [ ] Multi-process metric gaps: if `openeye serve` uses multiple Uvicorn workers, `psutil.Process()` reports only current process — child worker resources missed

### Technical Notes

- CPU and memory metrics use the `psutil` Python library
- GPU metrics use `pynvml` (same as story 160) with additional per-process queries via `nvmlDeviceGetComputeRunningProcesses`
- Network metrics use `psutil.net_io_counters(pernic=True)`
- Disk metrics use `shutil.disk_usage` for overall and `os.walk` for per-path breakdowns (cached)
- Resource collection runs in a dedicated background thread to avoid interfering with inference
- Metrics are registered in the same Prometheus registry as story 160
- Resource history uses SQLite with a circular buffer implementation for fixed storage overhead

---

## 168. Anomaly Detection on Metrics

**As a platform operator, I can enable automatic anomaly detection on key metrics that triggers proactive alerts before SLO breaches occur.**

### Acceptance Criteria

- [ ] `openeye serve --anomaly-detection` enables automatic anomaly detection on key infrastructure and inference metrics
- [ ] Anomaly detection runs on: `openeye_inference_duration_seconds` (latency), `openeye_inference_errors_total` (error rate), `openeye_frames_processed_total` (throughput), `openeye_gpu_utilization_percent`, `openeye_gpu_memory_used_bytes`
- [ ] Detection algorithm: Z-score anomaly detection with configurable sensitivity — `--anomaly-sensitivity` accepts `low` (Z > 4.0), `medium` (Z > 3.0, default), `high` (Z > 2.0)
- [ ] Seasonal decomposition: the detector learns daily and weekly patterns after a `--anomaly-learning-period` (default: 7 days) — anomalies account for expected patterns (e.g., lower traffic on weekends)
- [ ] Gauge metric `openeye_anomaly_score` reports the current anomaly score for each monitored metric — labeled by `metric_name`, `anomaly_type` (spike, drop, trend_change)
- [ ] Counter metric `openeye_anomalies_detected_total` counts total anomalies detected — labeled by `metric_name`, `anomaly_type`, `severity`
- [ ] When an anomaly is detected, a structured log entry is emitted at WARN level with: `metric_name`, `current_value`, `expected_range` (lower/upper bounds), `anomaly_score`, `anomaly_type`
- [ ] Anomaly alerts integrate with story 164 alerting: `--anomaly-alert-destinations pagerduty,slack` routes anomaly alerts to configured destinations
- [ ] Anomaly severity is automatically classified: `info` (2.0 < Z < 3.0), `warning` (3.0 < Z < 4.0), `critical` (Z > 4.0)
- [ ] `GET /admin/anomalies` returns a JSON list of recent anomalies with timestamps, metric names, scores, and current status (active/resolved)
- [ ] `GET /admin/anomalies/baselines` returns the learned baseline statistics (mean, stddev, seasonal components) for each monitored metric
- [ ] Anomaly detection on custom metrics: `--anomaly-watch openeye_custom_metric_name` adds user-defined metrics to the anomaly detection system
- [ ] Suppression windows: `--anomaly-suppress "Saturday 00:00-Sunday 23:59"` disables anomaly alerts during known low-activity periods (e.g., maintenance windows)

### Edge Cases

- [ ] Cold start (first 7 days): anomaly detection is in learning mode — no alerts fire, but `openeye_anomaly_score` still reports values. A `openeye_anomaly_detector_ready` gauge is 0 during learning and 1 once baselines are established
- [ ] Sudden legitimate traffic change (new cameras added, model upgraded): causes a burst of anomalies. `POST /admin/anomalies/reset-baseline` forces the detector to re-learn baselines immediately — resets the learning period
- [ ] Metric with zero variance (e.g., GPU utilization pinned at 100%): standard deviation is zero, Z-score is undefined — the detector uses an absolute change threshold (>10% deviation from mean) as a fallback
- [ ] Missing data points (metric stops reporting for a period): gaps are interpolated linearly for anomaly score calculation. If gaps exceed `--anomaly-max-gap` (default: 5 minutes), the gap period is excluded from baseline computation
- [ ] Rapid succession of anomalies on the same metric: deduplicated using a cooldown period (`--anomaly-alert-cooldown`, default: 15 minutes) — only the first anomaly fires an alert; subsequent anomalies within the cooldown update the existing alert
- [ ] Anomaly on a counter metric (e.g., `openeye_inference_errors_total`): the detector operates on the rate of change (derivative), not the raw counter value — a counter reset (process restart) does not trigger a false anomaly
- [ ] Seasonal pattern that shifts gradually (e.g., daylight saving time changes traffic patterns): the seasonal model uses exponential smoothing with a `--anomaly-seasonal-alpha` (default: 0.1) to adapt to shifting patterns over time
- [ ] Model hot-swap causes a legitimate latency spike: if the spike correlates with a `model.loaded` span event (story 161), the anomaly is auto-suppressed and labeled `model_change` instead of firing an alert
- [ ] High-frequency metric sampling (sub-second): the detector downsamples to 1-minute aggregates before analysis to reduce computational overhead
- [ ] Anomaly detection with multiple instances: each instance runs its own detector with its own baselines — anomalies are not correlated across instances unless `--anomaly-cluster-mode` aggregates metrics from all instances (requires shared storage for baselines)
- [ ] Persistent baselines: learned baselines are saved to `~/.openeye/anomaly-baselines.json` and restored on restart — no re-learning required after a restart
- [ ] False positive rate from non-Gaussian metrics: Z-score assumes normal distribution but latency is right-skewed (log-normal) — produces excessive false positives
- [ ] Anomaly detection duplicating threshold alerts: if story 164 alert already fires for same condition, anomaly detector fires too — no deduplication across alert types
- [ ] Baseline poisoning: if system is degraded during entire learning period, "normal" baseline is calibrated to degraded state — normal operation then flagged as anomalous

### Technical Notes

- Anomaly detection logic lives in `cli/openeye_ai/monitoring/anomaly.py`
- Uses `scipy.stats` for Z-score calculation and `statsmodels` for seasonal decomposition (STL)
- Baseline statistics are computed over a sliding window of `--anomaly-baseline-window` (default: 7 days) with 1-minute granularity
- Anomaly scores are computed every `--anomaly-eval-interval` (default: 60 seconds) in a background thread
- Dependencies are optional: `pip install openeye-sh[anomaly]` installs `scipy` and `statsmodels`
- Anomaly alerts use the same destination adapters as story 164
- Model change correlation uses the OpenTelemetry span event API (story 161) to check for recent `model.loaded` events

---

## 169. Health Check & Readiness Probes

**As a platform operator, I can configure comprehensive health checks for Kubernetes liveness, readiness, and startup probes that cover model loading, GPU availability, and dependency health.**

### Acceptance Criteria

- [ ] `GET /healthz` returns liveness status — `200 OK` with `{"status": "alive"}` if the process is running and not deadlocked; `503 Service Unavailable` if the event loop is blocked for >30 seconds
- [ ] `GET /readyz` returns readiness status — `200 OK` with `{"status": "ready", "checks": {...}}` when all readiness checks pass; `503 Service Unavailable` with failed check details when any check fails
- [ ] `GET /startupz` returns startup status — `200 OK` once the model is loaded and the first inference warmup completes; `503` during startup phase
- [ ] Readiness checks include: `model_loaded` (at least one model is loaded and responding), `gpu_available` (GPU device is accessible, if configured), `disk_space` (>500MB free in `~/.openeye/`), `memory` (process RSS < 90% of configured limit)
- [ ] Each check in `/readyz` response includes: `name`, `status` (pass/fail/warn), `message`, `duration_ms` (time to execute the check), `last_checked` (timestamp)
- [ ] Dependency health checks: `--health-check-deps "redis://cache:6379,http://model-registry:8080/health"` adds external dependency checks to `/readyz`
- [ ] GPU health check verifies: device is accessible (`cudaGetDeviceCount` > 0), not in ECC error state, temperature below thermal throttle threshold, driver is responsive
- [ ] Model health check performs a lightweight test inference on a synthetic 1x1 pixel image every `--health-check-interval` (default: 30 seconds) to verify the model is functional, not just loaded
- [ ] `GET /healthz/detail` returns comprehensive health information including: uptime, version, loaded models, GPU status, active connections, memory usage, last inference timestamp
- [ ] Health check endpoints are excluded from access logging and tracing (story 159, 161) to avoid noise from frequent Kubernetes probe requests — configurable via `--health-log-level none` (default) or `debug`
- [ ] Custom health checks can be registered via `POST /admin/health/checks` with a JSON payload defining a check name, URL to probe, expected status code, and timeout
- [ ] Health check response includes `X-Health-Check-Duration-Ms` header showing total health check execution time

### Edge Cases

- [ ] GPU driver crash (NVML returns `NVML_ERROR_GPU_IS_LOST`): `/readyz` immediately returns 503 with `gpu_available: fail` and message "GPU device lost — driver reset required". The liveness probe (`/healthz`) still returns 200 so Kubernetes doesn't kill the pod (restarting won't fix a driver crash)
- [ ] Model loading in progress (hot-swap): `/readyz` returns 503 with `model_loaded: fail` and `message: "Model swap in progress, estimated 30s remaining"`. `/healthz` returns 200. `/startupz` returns 200 (initial startup already completed)
- [ ] Health check dependency timeout: if an external dependency check exceeds `--health-check-timeout` (default: 5s), it is marked as `fail` with `message: "Timeout after 5000ms"` — other checks are not blocked
- [ ] Event loop deadlock detection: a background watchdog thread pings the main event loop every 10 seconds. If the event loop does not respond within `--liveness-timeout` (default: 30s), `/healthz` returns 503 and logs a FATAL error with a thread dump
- [ ] Memory leak: if `openeye_memory_rss_bytes` (story 167) grows monotonically for >1 hour beyond the initial baseline, `/readyz` includes a `memory_leak_suspected: warn` check — does not fail readiness but adds a warning
- [ ] Disk space check with remote/NFS storage: `disk_space` check uses a cached value (updated every 60s) to avoid slow filesystem calls blocking the health check response
- [ ] Multiple models loaded with mixed health: if model A is healthy but model B has crashed, `/readyz` reports `model_loaded: fail` with per-model breakdown — partial health is still failure
- [ ] Startup probe timeout in Kubernetes: if `--startup-warmup-timeout` (default: 120s) is exceeded (e.g., very large model), `/startupz` returns 503 with `message: "Model warmup timed out after 120s"` — Kubernetes will restart the pod per its `failureThreshold` config
- [ ] Concurrent health check requests: health checks are cached for `--health-cache-ttl` (default: 5s) — concurrent requests within the TTL window receive the cached result to avoid thundering herd on checks
- [ ] Health check during graceful shutdown: once `SIGTERM` is received, `/readyz` immediately returns 503 with `message: "Shutting down"` to drain traffic before the process exits — `/healthz` continues returning 200 until the process actually terminates
- [ ] Health endpoint thread starvation: if `/health` shares Uvicorn event loop and it's blocked by synchronous GPU operation, health check times out — false liveness failure
- [ ] Custom health check URL SSRF: `POST /admin/health/checks` accepts arbitrary URLs — compromised admin could add checks targeting internal services
- [ ] Test inference failing on certain models: 1×1 synthetic image may fail models with minimum input size (32×32, 640×640) — false health check failures

### Technical Notes

- Health check endpoints are defined in `server/health.py` and mounted on the FastAPI app
- Liveness watchdog runs in a separate daemon thread using `threading.Timer`
- GPU health uses `pynvml` with specific error code handling for driver crashes vs transient errors
- Startup warmup performs a single inference pass with a minimal synthetic image to populate CUDA kernels, JIT caches, etc.
- Health check endpoints follow Kubernetes probe conventions: HTTP status 200 for pass, 503 for fail
- Dependency checks use `httpx.AsyncClient` with per-dependency timeout configuration
- Health check logic is designed to complete within 1 second total for all checks — individual check timeouts ensure this

### Example Kubernetes Config

```yaml
# kubernetes deployment probe config
containers:
  - name: openeye
    image: ghcr.io/openeye-sh/openeye:latest
    ports:
      - containerPort: 8000
    livenessProbe:
      httpGet:
        path: /healthz
        port: 8000
      initialDelaySeconds: 10
      periodSeconds: 15
      timeoutSeconds: 5
      failureThreshold: 3
    readinessProbe:
      httpGet:
        path: /readyz
        port: 8000
      initialDelaySeconds: 5
      periodSeconds: 10
      timeoutSeconds: 5
      failureThreshold: 2
    startupProbe:
      httpGet:
        path: /startupz
        port: 8000
      initialDelaySeconds: 5
      periodSeconds: 10
      timeoutSeconds: 5
      failureThreshold: 30  # 5min for large model loading
```

---

## 170. Cost & Usage Analytics

**As an enterprise operator, I can view cost attribution analytics showing compute, GPU, bandwidth, and storage costs per tenant, camera, model, and site.**

### Acceptance Criteria

- [ ] `openeye serve --cost-tracking` enables cost attribution tracking for all resource consumption
- [ ] Cost dimensions: resources are attributed across `tenant_id`, `source_id` (camera), `model`, `site` (logical grouping of cameras), and `instance` (server)
- [ ] Counter metric `openeye_cost_gpu_seconds_total` tracks cumulative GPU time consumed — labeled by `tenant_id`, `model`, `device`, `precision` (fp16/fp32/int8)
- [ ] Counter metric `openeye_cost_cpu_seconds_total` tracks cumulative CPU time consumed — labeled by `tenant_id`, `model`
- [ ] Counter metric `openeye_cost_bandwidth_bytes_total` tracks cumulative network bandwidth consumed — labeled by `tenant_id`, `source_id`, `direction` (ingest/egress)
- [ ] Counter metric `openeye_cost_storage_bytes` tracks current storage consumption — labeled by `tenant_id`, `storage_type` (model_cache, logs, snapshots, wal)
- [ ] Counter metric `openeye_cost_inference_count_total` tracks total inference calls — labeled by `tenant_id`, `model`, `source_id`
- [ ] Cost rates are configurable via `--cost-config costs.yaml` with per-resource unit costs: GPU-hour rate, CPU-hour rate, bandwidth per GB, storage per GB-month
- [ ] `GET /admin/costs` returns a JSON cost report with: total cost, cost breakdown by dimension (tenant, model, camera, site), time period (configurable via `?from=&to=` query params)
- [ ] `GET /admin/costs/report?format=csv` exports cost data as a CSV file suitable for import into finance/billing systems
- [ ] `openeye costs report --tenant acme --period 2026-03 --output report.csv` generates a monthly cost report from the CLI
- [ ] Cost budgets: `--cost-budget-monthly 5000` (USD) sets a monthly spend limit per tenant. When 80% of the budget is consumed, a warning alert fires (story 164). At 100%, an `openeye_cost_budget_exceeded` alert fires
- [ ] Cost projections: `GET /admin/costs/forecast` returns a 30-day cost projection based on the current consumption rate with confidence intervals
- [ ] Real-time cost dashboard: a Grafana dashboard `dashboards/grafana/openeye-cost-analytics.json` (extends story 162) visualizes cost metrics with drilldown by tenant, model, and site

### Edge Cases

- [ ] Shared GPU inference (multiple tenants on same GPU without MIG): GPU time is attributed proportionally based on inference duration per tenant — `openeye_cost_gpu_seconds_total{tenant_id="acme"}` reflects only the time spent on that tenant's inference, not idle GPU time between requests
- [ ] Idle GPU cost attribution: time when the GPU is powered on but no inference is running is attributed to `tenant_id="__platform__"` as platform overhead — not billed to individual tenants
- [ ] Tenant with no activity in a billing period: cost report includes the tenant with $0.00 and zero usage — does not omit inactive tenants
- [ ] Cost rate changes mid-period: `--cost-config` hot-reload (via `PUT /admin/costs/config`) applies new rates prospectively — historical cost data is not retroactively recalculated. The rate change is logged with the effective timestamp
- [ ] High-cardinality source_id dimension: if >1000 unique cameras report costs, the metrics are aggregated to site-level granularity for Prometheus (to avoid cardinality explosion) while per-camera data is stored in the local cost database for report generation
- [ ] Currency configuration: `--cost-currency USD` (default) — cost values are stored as dimensionless numbers; the currency is metadata only, attached to reports and dashboard panels
- [ ] Cost data persistence: cost counters are persisted to `~/.openeye/cost-data.db` (SQLite) and survive process restarts — Prometheus counter values are reconstructed from the database on startup
- [ ] Multi-instance cost aggregation: each instance reports its own costs. The `/admin/costs` endpoint aggregates across instances only if `--cost-aggregation-endpoint http://cost-aggregator:8080` is configured; otherwise, it reports local instance costs only
- [ ] Budget alert at month boundary: monthly budgets reset on the 1st of each month at 00:00 UTC. If the process is restarted mid-month, the cost database ensures continuity — no double-counting or budget reset
- [ ] Cost forecast with seasonal variation: the projection model uses a 7-day exponential moving average to account for weekday/weekend patterns — not just a linear extrapolation of the current rate
- [ ] Negative cost values (credits/refunds): not supported at the metric level. Credits are applied at the report generation layer via `--cost-credits credits.yaml` with per-tenant credit amounts and expiry dates
- [ ] Cost report generation for large deployments (>100 tenants, >1000 cameras, 12 months): report generation runs asynchronously — `POST /admin/costs/report` returns a `report_id` and `GET /admin/costs/report/<id>` returns the status or completed report
- [ ] Cost data float precision drift: GPU seconds accumulated as float64 lose precision over long periods — monetary calculations based on imprecise counters
- [ ] Cost config tampering without audit: `PUT /admin/costs/config` allows rate changes — no audit logging for cost configuration changes (unlike log level changes in story 159)
- [ ] CUDA event timing overlap with concurrent kernels: multiple CUDA streams cause event timing overlap — total attributed GPU seconds could exceed wall-clock seconds

### Technical Notes

- Cost tracking logic lives in `cli/openeye_ai/billing/cost_tracker.py` with reporting in `report.py`
- GPU time measurement uses CUDA event timing (`torch.cuda.Event`) for precise per-inference GPU duration — not wall-clock time
- Cost data is stored in SQLite (`~/.openeye/cost-data.db`) with tables: `inference_costs`, `bandwidth_costs`, `storage_costs`, each partitioned by month
- Cost metrics are registered in the same Prometheus registry as story 160
- The Grafana cost dashboard uses both Prometheus queries (real-time) and the `/admin/costs` API (historical reports) via a mixed data source configuration
- Cost forecast uses `scipy.optimize.curve_fit` for trend estimation with confidence intervals
- CSV export follows a standardized billing format compatible with common enterprise finance tools
- Dependencies: `pip install openeye-sh[billing]` installs `scipy` (for forecasting)

### Example Config

```yaml
# costs.yaml
rates:
  gpu_hour:
    nvidia-a100: 3.50
    nvidia-t4: 0.75
    nvidia-l4: 1.25
  cpu_hour: 0.05
  bandwidth_gb:
    ingest: 0.01
    egress: 0.09
  storage_gb_month: 0.023

budgets:
  - tenant_id: acme
    monthly_limit: 5000
    alert_at: [0.5, 0.8, 0.95, 1.0]
  - tenant_id: globex
    monthly_limit: 12000
    alert_at: [0.8, 1.0]

currency: USD
```
