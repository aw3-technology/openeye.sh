# Billing & Licensing (171–180)

---

## 171. Usage Metering

**As a platform operator, I can track inference counts, API calls, bandwidth, GPU-hours, and active cameras per tenant so billing is based on accurate, auditable usage data.**

### Acceptance Criteria

- [ ] A metering service records every billable event to a durable, append-only event store (PostgreSQL `usage_events` table with partitioning by `tenant_id` and `event_month`)
- [ ] Metered dimensions include: `inference_count`, `api_calls`, `bandwidth_bytes`, `gpu_seconds`, `active_cameras`, `storage_bytes`, and `stream_minutes`
- [ ] Each metering event contains: `event_id` (UUIDv7), `tenant_id`, `project_id`, `resource_type`, `quantity`, `timestamp`, `metadata` (JSON — model name, endpoint, camera ID)
- [ ] `GET /api/v1/usage/current?tenant_id=<id>` returns real-time usage totals for the current billing period, broken down by dimension
- [ ] `GET /api/v1/usage/history?tenant_id=<id>&from=2026-01-01&to=2026-03-01` returns historical usage with configurable granularity (`hourly`, `daily`, `monthly`)
- [ ] `POST /api/v1/usage/events` is an internal endpoint that ingests metering events from inference workers, API gateways, and camera managers — authenticated via internal service token
- [ ] Inference workers emit a metering event on every `/predict`, `/predict/batch`, and WebSocket frame — event emission is async and non-blocking (does not add latency to inference)
- [ ] GPU-hours are tracked by recording GPU allocation start/stop times per worker, with per-second granularity, attributed to the tenant whose request triggered the allocation
- [ ] Active camera count is sampled every 60 seconds — the billing value is the peak concurrent camera count within the billing period
- [ ] Bandwidth metering tracks both ingress (uploaded images/streams) and egress (API responses, stream output) separately
- [ ] A `GET /api/v1/usage/summary?tenant_id=<id>&period=2026-03` returns a pre-aggregated summary suitable for invoice line items (see story 174)
- [ ] Usage data is retained for 24 months, then archived to cold storage (S3/GCS) and queryable via `GET /api/v1/usage/archive`
- [ ] All metering endpoints require `billing:read` scope; the internal ingestion endpoint requires `metering:write` scope
- [ ] Metering data is idempotent — replayed events with the same `event_id` are deduplicated

### Edge Cases

- [ ] If the metering service is temporarily unavailable, inference workers buffer events in a local write-ahead log (`~/.openeye/metering-wal/`) and replay them when the service recovers — no usage data is lost
- [ ] WAL replay after a prolonged outage (>1 hour): events are replayed in chronological order with rate limiting (`--wal-replay-rate 1000/s`) to avoid overwhelming the metering database
- [ ] Clock skew between inference workers and the metering service: events use the worker's timestamp but include a `server_received_at` field — billing aggregation tolerates up to 5 minutes of skew
- [ ] Tenant deletion: usage data is retained for the 24-month retention period even after tenant deletion, for audit and chargeback purposes
- [ ] GPU-hour tracking with shared GPUs (MPS/MIG): GPU time is proportionally attributed based on compute slice allocation — e.g., a 1/4 MIG slice reports 0.25 GPU-hours per wall-clock hour
- [ ] Burst inference (1000+ requests in 1 second): metering events are batched client-side (`--metering-batch-size 100`, `--metering-flush-interval 5s`) to reduce write amplification
- [ ] A tenant with zero usage in a period still gets a usage record with all dimensions set to 0, so billing can distinguish "no usage" from "missing data"
- [ ] If `bandwidth_bytes` exceeds `INT64_MAX` (theoretical, but guard against it), the counter rolls into a new row and the aggregation sums across rows
- [ ] Metering for failed requests: API calls that return 4xx/5xx are counted toward `api_calls` but not toward `inference_count` — only successful inferences are billed
- [ ] Multi-region deployments: each region's metering service writes to a regional database; a global aggregator merges usage across regions for unified billing with `region` as a dimension
- [ ] Timezone boundary double-counting: billing period boundary at 00:00 UTC — event at exact boundary could belong to either period, causing double-counting or missed events
- [ ] GPU allocation tracking on worker crash: if inference worker crashes mid-request, GPU stop time never recorded — no heartbeat-based timeout for orphan detection
- [ ] Kafka consumer lag: if consumer falls behind, 5-minute rollup produces incomplete aggregations — no lag monitoring or handling for partially consumed partitions
- [ ] Multi-region merge eventual consistency: global aggregator merging regional databases may encounter timing differences — no convergence guarantees

### Technical Notes

- Metering event schema uses CloudEvents format with `type: com.openeye.usage.<dimension>`
- The metering ingestion pipeline uses a Kafka topic (`openeye.metering.events`) as a buffer between workers and the database for durability and throughput
- Aggregation is performed by a scheduled job (every 5 minutes) that materializes hourly/daily/monthly rollups into `usage_rollups` table
- The WAL implementation reuses the same design as the data lake connector WAL (story 196)
- GPU tracking integrates with NVIDIA DCGM or `nvidia-smi` for accurate per-process GPU utilization

---

## 172. Subscription & Plan Management

**As an enterprise admin, I can manage subscription plans (Free, Pro, Enterprise) with feature gates and usage limits so my organization only pays for what it needs.**

### Acceptance Criteria

- [ ] Three built-in plans exist: **Free** (limited inference, 1 camera, community models), **Pro** (higher limits, 10 cameras, all models, webhook support), **Enterprise** (unlimited, custom models, SLA, SSO, audit logs)
- [ ] `GET /api/v1/billing/plans` returns the list of available plans with their feature flags, usage limits, and pricing
- [ ] `GET /api/v1/billing/subscription?tenant_id=<id>` returns the tenant's current plan, billing cycle start/end, usage vs. limits, and next renewal date
- [ ] `POST /api/v1/billing/subscription` creates or changes a subscription: `{"tenant_id": "...", "plan_id": "pro", "billing_cycle": "monthly"}` — changes take effect immediately with prorated charges
- [ ] `DELETE /api/v1/billing/subscription?tenant_id=<id>` cancels a subscription at end of billing period — the tenant retains access until the period ends
- [ ] Feature gates are enforced at the API gateway level: requests to gated features (e.g., `/api/v1/webhooks` on Free plan) return `403 Forbidden` with `{"error": "Feature not available on Free plan", "upgrade_url": "https://app.openeye.dev/upgrade"}`
- [ ] Plan limits are defined in a `plans.yaml` configuration file with per-dimension quotas: `max_inference_calls`, `max_cameras`, `max_bandwidth_gb`, `max_storage_gb`, `max_gpu_hours`, `max_projects`
- [ ] Plan changes (upgrades/downgrades) are logged in an `subscription_events` audit table with `event_type`, `old_plan`, `new_plan`, `changed_by`, `timestamp`
- [ ] `openeye serve --plan pro` enforces plan limits on the self-hosted CLI server — the server checks the license or subscription status on startup
- [ ] Annual billing is supported with a configurable discount: `--billing-cycle annual` applies the discount defined in `plans.yaml` (default: 20% off monthly rate)
- [ ] Custom Enterprise plans are supported: `POST /api/v1/billing/plans/custom` creates a plan with bespoke limits and pricing (requires `billing:admin` scope)
- [ ] Plan comparison endpoint: `GET /api/v1/billing/plans/compare?current=free&target=pro` returns a diff of features and limits for upgrade prompts
- [ ] All subscription management endpoints require `billing:write` scope; read endpoints require `billing:read`

### Edge Cases

- [ ] Downgrade with usage exceeding the lower plan's limits: the downgrade is scheduled for end of period, and a warning is returned listing which dimensions exceed the target plan's limits — e.g., `{"warning": "You have 8 active cameras but the Free plan allows 1. Reduce cameras before the downgrade takes effect on 2026-04-01."}`
- [ ] Mid-cycle upgrade from Free to Pro: proration calculates the remaining days in the period and charges proportionally — the invoice shows a line item for "Pro plan (prorated, 15 days)"
- [ ] Mid-cycle downgrade from Enterprise to Pro: remaining prepaid amount is credited to the tenant's balance — no refund is issued, but credit is applied to future invoices
- [ ] Plan change during an active trial (see story 177): if a tenant upgrades during a trial, the trial ends immediately and the paid subscription begins with a full billing cycle
- [ ] Subscription with unpaid invoices: plan changes are blocked until outstanding invoices are paid — returns `402 Payment Required` with `{"error": "Outstanding balance of $X must be paid before plan changes", "invoice_id": "inv_..."}`
- [ ] Concurrent plan change requests: only one plan change can be in flight per tenant — the second request returns `409 Conflict` with the pending change details
- [ ] Custom Enterprise plan deletion: if a custom plan is deleted while tenants are subscribed, the tenants are migrated to the nearest standard plan and notified
- [ ] Feature gate enforcement with cached plans: the API gateway caches plan data for up to 60 seconds — after a plan change, there is a brief window where the old gates apply. Cache is invalidated proactively on plan change events
- [ ] Annual subscription cancellation mid-year: the tenant retains access for the remainder of the paid year. No partial refund is issued unless specified by `refund_policy` in `plans.yaml`
- [ ] Plan with `max_cameras: 0` (e.g., an API-only plan): camera-related endpoints (`/api/v1/cameras`) return `403` with a message about the plan not supporting cameras, not a generic "limit reached" error
- [ ] Proration rounding errors: fractional cents (e.g., $49.99 / 30 × 15 = $24.995) — no rounding policy defined (banker's rounding, round up, etc.)
- [ ] Multiple plan changes within single billing cycle: upgrade then upgrade again — no compound proration handling
- [ ] Enterprise contract vs self-serve conflict: tenant with signed enterprise contract modified via self-serve API — no locking of enterprise subscriptions
- [ ] Downgrade enforcement timing: scheduled for end-of-period but tenant doesn't reduce usage by deadline — no behavior defined for forced disconnection or blocked downgrade

### Technical Notes

- Plan definitions live in `backend/config/plans.yaml` and are loaded into the `plans` database table on startup
- Feature gates are implemented as middleware in the API gateway that checks `tenant.plan.features[]` before routing
- Subscription state is stored in the `subscriptions` table with columns: `tenant_id`, `plan_id`, `status` (`active`, `trialing`, `past_due`, `canceled`), `current_period_start`, `current_period_end`, `cancel_at_period_end`
- Plan changes emit events to the `subscription_events` Kafka topic for downstream processing (invoicing, notifications, analytics)
- Integrates with Stripe subscription management (story 173) for payment processing

---

## 173. Stripe Billing Integration

**As a platform operator, I can integrate with Stripe for subscription billing, metered usage charges, and secure payment processing so revenue collection is automated and PCI-compliant.**

### Acceptance Criteria

- [ ] Stripe is the primary payment processor — the platform uses Stripe Subscriptions for recurring billing and Stripe Usage Records for metered charges
- [ ] Each tenant maps to a Stripe `Customer` object created via `POST /api/v1/billing/customers` which calls `stripe.Customer.create()` and stores the `stripe_customer_id` in the `tenants` table
- [ ] Plan subscriptions map to Stripe `Subscription` objects with `Price` IDs defined in `plans.yaml` — e.g., `stripe_price_id: price_pro_monthly_2026`
- [ ] Metered usage (inference calls, bandwidth, GPU-hours) is reported to Stripe via `stripe.SubscriptionItem.create_usage_record()` at the end of each billing period using data from the usage metering system (story 171)
- [ ] `POST /api/v1/billing/checkout` creates a Stripe Checkout Session for new subscriptions and returns the checkout URL — the frontend redirects to Stripe's hosted payment page
- [ ] `POST /api/v1/billing/portal` creates a Stripe Billing Portal session for existing customers to manage payment methods, view invoices, and cancel subscriptions
- [ ] Webhook endpoint `POST /api/v1/billing/webhooks/stripe` receives and processes Stripe webhook events with signature verification (`stripe.Webhook.construct_event()` using `STRIPE_WEBHOOK_SECRET`)
- [ ] Handled webhook events: `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`, `checkout.session.completed`, `payment_method.attached`, `charge.refunded`, `customer.subscription.trial_will_end`
- [ ] On `invoice.paid`: the tenant's subscription status is updated to `active`, usage counters are reset for the new billing period, and a receipt is sent via email
- [ ] On `invoice.payment_failed`: the tenant's status is set to `past_due`, a grace period of 7 days begins (configurable via `BILLING_GRACE_PERIOD_DAYS`), and the admin is notified with a link to update payment
- [ ] On `customer.subscription.deleted`: the tenant's plan is downgraded to Free, all paid features are gated, and a confirmation email is sent
- [ ] Stripe API keys are stored as environment variables (`STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`) or fetched from the secrets manager (story 199)
- [ ] All Stripe API calls use idempotency keys to prevent duplicate charges on retries

### Edge Cases

- [ ] Stripe webhook replay (duplicate event delivery): events are deduplicated by `event.id` — a `processed_stripe_events` table tracks processed event IDs with a 30-day TTL
- [ ] Stripe webhook signature verification failure: the request is rejected with `400 Bad Request` and the attempt is logged with the source IP for security monitoring — no billing state is modified
- [ ] Stripe API downtime: subscription creation and payment method updates queue locally and retry with exponential backoff. The tenant sees a "Payment processing — please check back shortly" message
- [ ] Currency mismatch: all prices are defined in USD by default. Stripe handles multi-currency conversion — the platform stores the `currency` on each invoice for reporting accuracy
- [ ] Customer with expired payment method: when `invoice.payment_failed` fires, Stripe's Smart Retries handle automatic retry logic. The platform sends a payment update reminder on day 1, 3, and 6 of the grace period
- [ ] Stripe rate limiting (429): the Stripe SDK's built-in retry handles this. If retries are exhausted, the operation is queued for manual processing and an alert is sent to the billing ops team
- [ ] Test mode: `STRIPE_SECRET_KEY` starting with `sk_test_` activates test mode — all webhook events from test mode are processed identically but flagged as `test: true` in the database. Test and production events are isolated
- [ ] Subscription with multiple metered line items (inference + bandwidth + GPU-hours): each dimension maps to a separate `SubscriptionItem` with its own `Price` ID. Usage records are reported per-item
- [ ] Stripe webhook event ordering: events may arrive out of order (e.g., `invoice.paid` before `checkout.session.completed`). The handler checks subscription state before applying changes and requeues events that arrive out of sequence
- [ ] Refund processing: `charge.refunded` triggers a credit on the tenant's account. Partial refunds are supported — the credit amount matches the refund amount, not the full invoice
- [ ] 3D Secure / SCA challenge flow: no handling for `payment_intent.requires_action` — cards requiring 3DS (EU mandated) fail silently
- [ ] Idempotency key collision: `SHA-256(tenant_id + action + timestamp_hour)` — two different operations in same hour with same action string collide, second dropped silently
- [ ] Metered usage reporting timing: usage reported at end of period but Stripe may finalize invoice before report arrives — results in $0 invoice then correction
- [ ] Stripe Customer object duplication: if Stripe call succeeds but local DB write fails, retry creates second Customer — no orphaned object reconciliation

### Technical Notes

- Uses the `stripe` Python SDK (v7+) with `stripe.api_key` set from environment or secrets manager
- Stripe webhook handler lives in `backend/billing/stripe_webhooks.py`
- Idempotency keys are generated as `SHA-256(tenant_id + action + timestamp_hour)` to prevent duplicates within a 1-hour window
- Stripe Checkout and Billing Portal sessions use `success_url` and `cancel_url` pointing to the self-service billing portal (story 179)
- Metered usage reporting runs as a scheduled job at the end of each billing period: `backend/billing/report_usage.py`
- The `stripe_customer_id` is stored in the `tenants` table and cross-referenced on every billing operation

---

## 174. Invoice Generation

**As an enterprise admin, I get automated monthly invoices with detailed usage breakdowns by resource type, project, and site so I can reconcile costs and allocate them to internal teams.**

### Acceptance Criteria

- [ ] Invoices are automatically generated at the end of each billing period (monthly or annually) via a scheduled job that runs at 00:00 UTC on the 1st of each month
- [ ] `GET /api/v1/billing/invoices?tenant_id=<id>` returns a paginated list of invoices with `invoice_id`, `status` (`draft`, `open`, `paid`, `void`, `uncollectible`), `amount_due`, `currency`, `period_start`, `period_end`, `created_at`
- [ ] `GET /api/v1/billing/invoices/<invoice_id>` returns the full invoice with line items, each containing: `description`, `resource_type`, `project_id`, `site_id`, `quantity`, `unit_price`, `amount`, `metadata`
- [ ] `GET /api/v1/billing/invoices/<invoice_id>/pdf` returns a rendered PDF invoice with company branding, line items, subtotals by category, tax, and total
- [ ] Invoice line items are grouped by resource type: **Inference** (per-call charges), **Cameras** (per-camera-month), **Bandwidth** (per-GB), **GPU Compute** (per-GPU-hour), **Storage** (per-GB-month)
- [ ] Each line item can be further broken down by `project_id` and `site_id` for multi-project/multi-site enterprises: `GET /api/v1/billing/invoices/<invoice_id>/breakdown?group_by=project`
- [ ] Invoices include: subscription base fee (fixed monthly charge per plan), metered usage charges (variable), credits/discounts, tax (calculated via Stripe Tax or a configured tax rate), and total
- [ ] Draft invoices are generated 3 days before the billing period ends (`draft` status) — admins can review via the billing portal (story 179) before finalization
- [ ] `POST /api/v1/billing/invoices/<invoice_id>/finalize` transitions a draft invoice to `open` status and triggers payment collection via Stripe (story 173)
- [ ] Invoice numbering follows a sequential format: `INV-<TENANT_SHORT>-<YYYYMM>-<SEQ>` (e.g., `INV-ACME-202603-001`)
- [ ] Tax calculation supports US sales tax, EU VAT, and configurable tax rates via `--tax-provider stripe|manual` with `--tax-rate 0.08` fallback
- [ ] Credit notes: `POST /api/v1/billing/invoices/<invoice_id>/credit` creates a credit note for partial or full adjustments, linked to the original invoice
- [ ] Invoice emails are sent automatically on finalization with the PDF attached — email template is customizable via `backend/templates/invoice_email.html`
- [ ] All invoice endpoints require `billing:read` scope; finalization and credit notes require `billing:admin`

### Edge Cases

- [ ] Tenant with zero usage and a $0 plan (Free tier): an invoice is still generated with $0.00 total and `auto_paid` status for record-keeping — no email is sent for $0 invoices unless `--send-zero-invoices` is configured
- [ ] Invoice generation fails mid-run (database error, Stripe outage): the job is idempotent — re-running generates only invoices that haven't been created yet, identified by `(tenant_id, period_start, period_end)` unique constraint
- [ ] Usage data arrives after invoice finalization (late metering events from WAL replay): a supplementary invoice is generated for the additional charges with a reference to the original invoice
- [ ] Currency conversion: for international tenants, the invoice is generated in the tenant's preferred currency (stored in `tenants.billing_currency`). Exchange rates are locked at the invoice generation timestamp
- [ ] PDF rendering failure (template error, missing fonts): the invoice is created in the database without a PDF, an alert is sent to billing ops, and the admin can still view the invoice via the API/portal
- [ ] Multi-year enterprise contract with committed spend: invoices show the contracted rate vs. actual usage, and any unused committed spend is noted as "Committed usage — unused balance: $X"
- [ ] Tax rate changes mid-period: the invoice applies the tax rate effective at the end of the billing period. A note is included if the rate changed during the period
- [ ] Invoice PDF exceeding 10MB (enterprise with thousands of line items): line items are summarized by project/site in the PDF with a "See detailed breakdown in portal" link. The full detail is available via the API
- [ ] Voided invoices: `POST /api/v1/billing/invoices/<invoice_id>/void` voids an open invoice. Voided invoices are retained for audit but excluded from revenue calculations
- [ ] Invoice dispute: admins can flag an invoice via `POST /api/v1/billing/invoices/<invoice_id>/dispute` which pauses collection and notifies billing ops
- [ ] Tax exemption handling: no mention of tax-exempt enterprises (government, nonprofit, reseller) with certificates
- [ ] Multi-jurisdiction tax: enterprise with cameras in multiple states/countries may owe different tax rates per line item — no per-line-item tax by usage location
- [ ] Invoice data retention vs GDPR right-to-delete: financial records must be retained 7+ years for tax/audit but GDPR allows deletion — no reconciliation defined
- [ ] Auto-finalization deadline: draft invoices generated 3 days before period end with no auto-finalization deadline could remain draft indefinitely

### Technical Notes

- Invoice generation job lives in `backend/billing/invoice_generator.py` and runs via a cron scheduler (Celery Beat or Kubernetes CronJob)
- PDF rendering uses `weasyprint` or `reportlab` with templates in `backend/templates/invoice.html`
- Invoice data is stored in `invoices` and `invoice_line_items` tables with foreign keys to `tenants`, `plans`, and `usage_rollups`
- Stripe invoice synchronization: each internal invoice maps to a Stripe Invoice object — the `stripe_invoice_id` is stored for reconciliation
- The breakdown by project/site uses the `project_id` and `site_id` dimensions from the metering system (story 171)

---

## 175. Usage Quotas & Limits

**As an enterprise admin, I can set and enforce hard/soft quotas on inference calls, cameras, bandwidth, and storage per tenant and project so costs are controlled and resources are shared fairly.**

### Acceptance Criteria

- [ ] `POST /api/v1/billing/quotas` creates a quota rule: `{"tenant_id": "...", "project_id": "..." (optional), "dimension": "inference_count", "soft_limit": 50000, "hard_limit": 100000, "period": "monthly"}`
- [ ] `GET /api/v1/billing/quotas?tenant_id=<id>` returns all active quotas for a tenant with current usage vs. limits
- [ ] `PUT /api/v1/billing/quotas/<quota_id>` updates an existing quota's soft/hard limits
- [ ] `DELETE /api/v1/billing/quotas/<quota_id>` removes a quota — usage continues to be metered but is no longer enforced
- [ ] **Soft limit**: when usage reaches the soft limit, a notification is sent (email + webhook) but requests continue to be served. Notification includes current usage, limit, and projected end-of-period usage
- [ ] **Hard limit**: when usage reaches the hard limit, the configured overage policy is applied (see story 178) — default is `block` which returns `429 Too Many Requests` with `{"error": "Usage quota exceeded", "dimension": "inference_count", "limit": 100000, "current": 100001, "reset_at": "2026-04-01T00:00:00Z"}`
- [ ] Quotas are enforced at the API gateway level via a fast, in-memory counter (Redis) that is synchronized with the metering database every 60 seconds
- [ ] Supported dimensions: `inference_count`, `api_calls`, `active_cameras`, `bandwidth_gb`, `storage_gb`, `gpu_hours`, `stream_minutes`
- [ ] Per-project quotas allow enterprise admins to subdivide their tenant quota across teams/projects — per-project quotas cannot exceed the tenant-level quota
- [ ] Quota notifications are sent at configurable thresholds: `--notify-at 50,75,90,100` (percent of soft limit) — defaults to 80% and 100%
- [ ] `GET /api/v1/billing/quotas/<quota_id>/forecast` returns a linear projection of when the soft/hard limit will be reached based on trailing 7-day usage rate
- [ ] Real-time quota status is available in the dashboard (story 179) with a visual gauge showing usage vs. soft/hard limits per dimension
- [ ] Quota enforcement respects a configurable burst allowance: `"burst_allowance": 1.1` allows 10% burst above the hard limit for 5 minutes before blocking
- [ ] All quota endpoints require `billing:admin` scope for write operations and `billing:read` for read operations

### Edge Cases

- [ ] Redis counter drift: if the in-memory counter gets ahead of the metering database (e.g., Redis restart resets counters to 0), the synchronization job restores counters from the database — during the sync gap (up to 60 seconds), the quota is temporarily unenforced rather than incorrectly blocking
- [ ] Concurrent requests that simultaneously cross the hard limit: Redis `INCR` is atomic, so only the request that increments past the limit is blocked — no race condition where multiple requests sneak through
- [ ] Quota reset at billing period boundary: counters reset to 0 at `current_period_end` (from the subscription). If the reset job fails, the quota carries stale usage from the previous period — a fallback check compares `event_timestamp` to `period_start` to filter stale events
- [ ] Per-project quota exceeds tenant quota: `POST /api/v1/billing/quotas` rejects the request with `{"error": "Project quota (120000) cannot exceed tenant quota (100000) for dimension inference_count"}`
- [ ] Tenant with no explicit quotas: plan-level limits from `plans.yaml` (story 172) are used as default quotas — these cannot be exceeded but can be tightened via explicit quotas
- [ ] Soft limit notification storm: if usage hovers around the soft limit (oscillating above/below), notifications are debounced — only one notification per threshold per 24-hour period
- [ ] Quota on `active_cameras` dimension: this is a gauge (not a counter), so it is checked on camera connect, not on each request. Connecting a camera beyond the limit returns `403 Forbidden` with `{"error": "Active camera limit reached (10/10)"}`
- [ ] Admin sets soft limit higher than hard limit: rejected with `{"error": "Soft limit (120000) must be less than or equal to hard limit (100000)"}`
- [ ] Quota dimension not tracked by metering: if an admin creates a quota for a dimension that the metering system doesn't report (e.g., a custom dimension), the quota is stored but never enforced — a warning is logged on creation
- [ ] Billing period change (monthly to annual): existing quotas with `period: monthly` continue to enforce monthly limits within the annual cycle. The admin can update quotas to `period: annual` if desired
- [ ] Redis cluster failover during quota check: quota counter may reset to 0 or become temporarily unavailable — story mentions restart but not cluster failover
- [ ] Multi-region quota enforcement: tenant hitting limit in region A may still be served in region B — quotas enforced per-region, not globally
- [ ] Burst allowance abuse: 1.1× burst (10% above hard limit for 5 minutes) can be exploited repeatedly — no burst cooldown or per-period burst budget

### Technical Notes

- Quota definitions are stored in the `quotas` table: `quota_id`, `tenant_id`, `project_id`, `dimension`, `soft_limit`, `hard_limit`, `period`, `burst_allowance`, `notify_thresholds`
- Enforcement uses Redis sorted sets with TTL matching the billing period for automatic counter expiry
- The API gateway middleware checks quotas on every request via a Lua script in Redis for sub-millisecond latency
- Quota sync job runs every 60 seconds: `backend/billing/quota_sync.py` reconciles Redis counters with the `usage_rollups` table
- Notifications are sent via the notification service (email + webhook) with templates in `backend/templates/quota_*.html`
- Forecast calculation uses linear regression on the trailing 7-day `usage_rollups` data at hourly granularity

---

## 176. License Key Management

**As a self-hosted enterprise customer, I can activate OpenEye with a license key that encodes feature flags, device limits, and expiry so I can run the platform on-premises without a cloud connection.**

### Acceptance Criteria

- [ ] `openeye activate <license-key>` activates a self-hosted installation by validating the key and storing the license at `~/.openeye/license.json`
- [ ] License keys are cryptographically signed JWTs (RS256) with the payload: `{"tenant_id": "...", "plan": "enterprise", "features": ["custom_models", "sso", "audit_logs", ...], "max_cameras": 50, "max_gpu_nodes": 10, "issued_at": "...", "expires_at": "...", "offline": true}`
- [ ] The CLI verifies the JWT signature against OpenEye's embedded public key (`cli/openeye_ai/keys/license_public.pem`) — no network call required for validation
- [ ] `openeye license status` displays: tenant name, plan, feature flags, camera/device limits, expiry date, days remaining, and activation status
- [ ] `openeye serve` checks the license on startup — if expired or invalid, the server starts in Free-tier mode with a warning: `"License expired. Running with Free tier limits. Contact sales@openeye.dev to renew."`
- [ ] Feature flags in the license gate CLI and server features: e.g., `custom_models` enables `openeye serve --model custom:my-model.pt`, `sso` enables SAML/OIDC authentication
- [ ] `POST /api/v1/licensing/keys` (admin API) generates a new license key for a tenant with specified features, limits, and expiry — requires `licensing:admin` scope
- [ ] `GET /api/v1/licensing/keys?tenant_id=<id>` lists all license keys for a tenant with their status (`active`, `expired`, `revoked`)
- [ ] `POST /api/v1/licensing/keys/<key_id>/revoke` revokes a license key — revoked keys are added to a revocation list that is checked on the next online activation
- [ ] Online activation: `openeye activate <key>` calls `POST /api/v1/licensing/activate` to register the device (hostname, MAC address hash, OS) and download the latest revocation list
- [ ] Offline activation: `openeye activate --offline <key>` skips the server call and validates only the JWT signature and expiry — suitable for air-gapped environments
- [ ] License renewal: `openeye activate <new-key>` replaces the existing license without requiring deactivation — the old key is overwritten
- [ ] Device limit enforcement: the license key's `max_gpu_nodes` is enforced by counting active nodes in `openeye serve --cluster` mode — exceeding the limit prevents new nodes from joining

### Edge Cases

- [ ] License key with tampered payload (modified JWT): signature verification fails and the CLI prints `"Invalid license key: signature verification failed. Contact support if this is unexpected."`— does not activate
- [ ] License key generated with a future `issued_at` (clock manipulation): the CLI rejects keys with `issued_at` more than 5 minutes in the future — logs a warning about clock synchronization
- [ ] License expires while the server is running: the server does not immediately shut down. A background check runs every hour — when expiry is detected, the server logs a warning every 10 minutes and enters a 72-hour grace period before downgrading to Free tier
- [ ] Multiple activations of the same key: online activation tracks the device count. If `max_gpu_nodes` is exceeded, the activation is rejected with `{"error": "Device limit reached (10/10). Deactivate an existing device or upgrade your license."}`
- [ ] Revoked key used in offline mode: the key passes JWT validation (since revocation requires a server check) but will be caught on the next online activation. The CLI checks the local revocation list cache (`~/.openeye/revocation-list.json`) if available
- [ ] Corrupted `license.json` file: the CLI detects JSON parse errors and prompts re-activation — does not crash with a traceback
- [ ] Clock rollback attack (setting system clock back to extend expiry): the license check uses both system time and a monotonic "last-checked" timestamp stored in `license.json` — if the system clock is earlier than the last check, a warning is logged and the later time is used
- [ ] License key for a plan that doesn't exist in the local `plans.yaml`: the CLI logs a warning and applies the features explicitly encoded in the JWT — does not require a matching local plan definition
- [ ] Air-gapped environment with no initial revocation list: offline activation works without a revocation list — the CLI logs an informational message: "No revocation list available. Run 'openeye activate --sync' when network access is available."
- [ ] License key size: JWT keys are typically 1-2KB. If a key exceeds 8KB (indicating tampering or corruption), the CLI rejects it before attempting JWT parsing
- [ ] Downgrade from Enterprise license to a lower-tier license: existing configurations using Enterprise-only features (e.g., custom models, SSO) continue to function for a 7-day grace period, then are disabled with a descriptive log message per feature
- [ ] Public key rotation/compromise: if embedded RS256 public key needs rotation (private key compromised), all deployed CLIs have stale key — no key rotation strategy or `kid` in JWT header
- [ ] Device ID instability in containers/K8s: `SHA-256(hostname + MAC)` changes on every pod restart — rapidly exhausts `max_gpu_nodes`
- [ ] VM snapshot/clone attack: licensed VM cloned N times, all with same device ID — clones bypass device limit since they report same ID
- [ ] Container/Kubernetes deployment: ephemeral containers generate new hostname/MAC each restart — no persistent volume claim ID or node ID based identification

### Technical Notes

- License keys are JWTs signed with RS256 — the private key is held server-side only; the public key is embedded in the CLI package
- The public key is also available at `GET /api/v1/licensing/public-key` for verification by third-party tools
- `license.json` contains the raw JWT, decoded payload (for quick reads without JWT parsing), and metadata (`activated_at`, `device_id`, `last_checked`)
- Device ID is generated as `SHA-256(hostname + MAC address primary interface)` — stored in the license server for device tracking
- Revocation list is a signed JSON file containing an array of revoked `key_id` values — signed with the same RS256 key as licenses
- License management API lives in `backend/licensing/` with `key_generator.py`, `activation.py`, `revocation.py`

---

## 177. Free Tier & Trial Management

**As a new user, I get a free tier with limited inference calls so I can evaluate OpenEye without payment, and as a prospect, I get a time-limited trial of Pro/Enterprise features so I can test advanced capabilities before purchasing.**

### Acceptance Criteria

- [ ] New user registration automatically provisions a **Free tier** subscription with: 1,000 inference calls/month, 1 active camera, 5 GB bandwidth, community models only, no webhook/SSO/audit features
- [ ] `POST /api/v1/billing/trials` creates a trial for a tenant: `{"tenant_id": "...", "trial_plan": "pro", "duration_days": 14}` — requires `billing:admin` scope or a valid trial invitation token
- [ ] During a trial, the tenant has full access to the trial plan's features and limits — the API response includes `"trial": true, "trial_ends_at": "2026-03-29T00:00:00Z"` in all authenticated responses
- [ ] `GET /api/v1/billing/trials?tenant_id=<id>` returns trial status: `active`, `expired`, `converted` (upgraded to paid plan)
- [ ] Trial countdown notifications are sent at 3 days, 1 day, and 0 days remaining via email with a CTA to upgrade
- [ ] When a trial expires without conversion: the tenant is downgraded to Free tier, all trial-only features are gated, but data is retained — the admin sees a "Trial expired — upgrade to retain access to Pro features" banner in the dashboard
- [ ] Free tier usage is metered identically to paid plans (story 171) — usage data is available for the user to see their consumption patterns before upgrading
- [ ] `openeye` CLI on Free tier prints a subtle footer on each command: `"Free tier: 743/1,000 inference calls remaining. Upgrade at https://app.openeye.dev/upgrade"`
- [ ] Trial extensions: `POST /api/v1/billing/trials/<trial_id>/extend` adds days to an active or recently-expired trial — requires `billing:admin` scope
- [ ] Self-service trial signup: `POST /api/v1/billing/trials/self-serve` allows unauthenticated users to start a trial with email verification — limited to one trial per email address
- [ ] Trial invitation links: `POST /api/v1/billing/trials/invite` generates a unique URL (`https://app.openeye.dev/trial?token=<jwt>`) that auto-provisions a trial on first use
- [ ] Free tier does not require a credit card — trial may optionally require one based on `TRIAL_REQUIRE_CC` configuration (default: false)

### Edge Cases

- [ ] User attempts to start a second trial after the first expired: rejected with `{"error": "A trial has already been used for this account. Contact sales@openeye.dev for a custom evaluation."}` — one trial per `tenant_id` per `trial_plan`
- [ ] User creates multiple accounts to get multiple trials: rate-limited by email domain and IP address — more than 3 trials from the same email domain within 30 days triggers a manual review flag
- [ ] Trial expires at midnight UTC while inference is actively running: the in-flight request completes successfully, but the next request is governed by Free tier limits — no mid-request interruption
- [ ] Trial user exceeds Free tier limits during trial (e.g., uses 2,000 inference calls during a Pro trial): this is allowed — the trial plan's limits apply during the trial. After trial expiry, the user drops to Free tier limits starting from 0 usage for the new period
- [ ] Trial with `duration_days: 0`: rejected with `{"error": "Trial duration must be at least 1 day"}`
- [ ] Trial extension beyond 90 days total: rejected with `{"error": "Maximum total trial duration is 90 days. Contact sales for extended evaluation needs."}`
- [ ] Free tier user who has never trialed receives a trial invitation for Enterprise: the trial is provisioned and the user jumps directly from Free to Enterprise features for the trial duration — on expiry, they return to Free (not Pro)
- [ ] Trial invitation token used after expiry (tokens expire after 30 days): returns `410 Gone` with `{"error": "Trial invitation has expired. Request a new invitation."}`
- [ ] Data created during trial (custom models, webhook configs, zones): retained after trial expiry but inaccessible until upgrade — `GET /api/v1/webhooks` returns `{"data": [], "gated_count": 5, "message": "5 webhooks are locked. Upgrade to Pro to re-enable."}`
- [ ] Self-serve trial from a disposable email domain: blocked with `{"error": "Please use a business email address to start a trial"}` — disposable domain list is maintained in `backend/config/disposable_domains.txt`
- [ ] Free tier rate limiting: `/predict` is rate-limited to 10 requests/minute on Free tier (vs. 100/min on Pro) — returns `429` with `{"error": "Free tier rate limit exceeded. Upgrade for higher limits."}`
- [ ] Trial-to-paid conversion card decline: card valid at trial start but declines on conversion — no retry or grace period specifically for this transition
- [ ] Trial resources exceeding Free tier limits: trial creates 10 cameras but Free tier allows 3 — no defined behavior for which cameras disconnect after expiry

### Technical Notes

- Trial state is stored in the `trials` table: `trial_id`, `tenant_id`, `trial_plan`, `started_at`, `expires_at`, `status`, `invitation_token`
- Trial expiry is checked by a scheduled job running every 5 minutes: `backend/billing/trial_expiry.py`
- The Free tier subscription is created via the same subscription management system as paid plans (story 172) with `plan_id: free`
- Trial invitations use short-lived JWTs (30-day expiry) signed with the platform's signing key
- The CLI footer on Free tier is controlled by the `/health` response which includes `plan` and `usage` fields when authenticated
- Disposable email detection uses a configurable domain blocklist, not a third-party API

---

## 178. Overage Handling

**As an enterprise admin, when my tenant exceeds plan limits, the platform handles overages via configurable policies (throttle, charge, notify, block) so there are no surprise outages or unexpected costs.**

### Acceptance Criteria

- [ ] `POST /api/v1/billing/overage-policy` sets the overage policy per tenant and dimension: `{"tenant_id": "...", "dimension": "inference_count", "policy": "charge", "overage_rate": 0.002, "max_overage_spend": 500}`
- [ ] `GET /api/v1/billing/overage-policy?tenant_id=<id>` returns all configured overage policies with current overage status
- [ ] Four overage policies are supported:
  - **block**: requests are rejected with `429 Too Many Requests` once the hard limit is reached (default for Free tier)
  - **throttle**: requests are rate-limited to 10% of normal throughput after the hard limit — `Retry-After` header indicates when full throughput resumes
  - **charge**: requests continue to be served and metered at the configured `overage_rate` per unit — the overage charges appear on the next invoice (story 174)
  - **notify**: requests continue unthrottled, but notifications are sent at every 10% increment above the limit (110%, 120%, etc.) — no additional charges
- [ ] Overage policies can be set per-dimension: e.g., `inference_count: charge`, `bandwidth_gb: throttle`, `active_cameras: block`
- [ ] Default overage policy per plan is defined in `plans.yaml`: Free = `block`, Pro = `notify`, Enterprise = `charge`
- [ ] `max_overage_spend` (for `charge` policy): sets a dollar cap on overage charges per billing period — once reached, the policy automatically switches to `block` and the admin is notified
- [ ] Overage charges are itemized separately on invoices: "Overage: Inference calls (12,345 calls above plan limit @ $0.002/call = $24.69)"
- [ ] `GET /api/v1/billing/overage-status?tenant_id=<id>` returns real-time overage status: `{"in_overage": true, "dimensions": {"inference_count": {"limit": 100000, "current": 112345, "overage": 12345, "policy": "charge", "overage_cost": 24.69}}}`
- [ ] Overage notifications include: dimension, current usage, limit, overage amount, estimated end-of-period cost, and a link to upgrade or adjust the policy
- [ ] `throttle` policy reduces throughput gradually: at 100% of limit = 50% throughput, at 150% = 25% throughput, at 200% = 10% throughput (minimum) — the degradation curve is configurable
- [ ] Policy changes take effect immediately — no need to wait for the next billing period
- [ ] All overage policy endpoints require `billing:admin` scope

### Edge Cases

- [ ] `charge` policy with no payment method on file: the overage is accrued but the admin receives an urgent notification to add a payment method. If no payment method is added within 7 days, the policy auto-switches to `block`
- [ ] `throttle` policy with WebSocket streaming: the stream FPS is reduced proportionally to the throttle rate — the connection is not dropped, but frames are skipped with a `throttled: true` flag in the metadata
- [ ] Multiple dimensions in overage simultaneously: each dimension's policy is applied independently. If `inference_count` is `charge` and `bandwidth_gb` is `block`, inference continues but large responses that would exceed the bandwidth limit are rejected
- [ ] Overage `charge` rate of $0 (configured by admin): effectively becomes a `notify` policy — usage continues, overages are recorded at $0, and notifications are sent
- [ ] `max_overage_spend` reached mid-request: the request that triggers the cap is completed, but the next request is blocked. The exact spend may slightly exceed `max_overage_spend` by the cost of one request
- [ ] Policy set to `charge` but Stripe billing integration (story 173) is not configured: rejected with `{"error": "Charge overage policy requires Stripe integration. Configure Stripe or use a different policy."}`
- [ ] Billing period rollover while in overage: overage counters reset, the accrued overage charges are finalized on the invoice, and the new period starts with a clean slate
- [ ] Overage on `active_cameras` (gauge metric, not counter): `block` policy prevents connecting additional cameras but does not disconnect existing ones. `throttle` policy reduces FPS on all cameras proportionally
- [ ] Tenant admin changes policy from `charge` to `block` mid-period: existing overage charges are retained on the invoice, and the `block` policy takes effect immediately for future requests
- [ ] Race condition between overage detection and policy enforcement: the enforcement lag (up to 60 seconds due to Redis sync interval from story 175) means a small number of requests may be served between hitting the limit and enforcement activating — these are charged at the overage rate retroactively
- [ ] Throttle policy violating SLA commitments: enterprise customers with SLA guarantees on uptime/latency may be throttled — no SLA-aware throttling exceptions
- [ ] Overage charge rounding: sub-cent quantities (12,343 × $0.002 = $24.686) — no rounding policy for overage invoice amounts
- [ ] Aggregate overage cap missing: per-dimension `max_overage_spend` across 5 dimensions could total $2,500 — no tenant-level aggregate cap

### Technical Notes

- Overage policies are stored in the `overage_policies` table: `policy_id`, `tenant_id`, `dimension`, `policy` (`block|throttle|charge|notify`), `overage_rate`, `max_overage_spend`, `throttle_curve`
- Enforcement reuses the quota enforcement middleware from story 175 — when usage exceeds `hard_limit`, the middleware consults the overage policy instead of always blocking
- Throttle implementation uses a token bucket algorithm in Redis with the bucket refill rate reduced proportionally to the overage percentage
- Overage charge calculation runs as part of the invoice generation job (story 174): `backend/billing/overage_charges.py`
- Overage notifications use the same notification system as quota alerts (story 175) with templates in `backend/templates/overage_*.html`

---

## 179. Self-Service Billing Portal

**As an enterprise admin, I get a web portal to view usage, manage subscriptions, update payment methods, and download invoices so I can handle billing without contacting support.**

### Acceptance Criteria

- [ ] The billing portal is accessible at `https://app.openeye.dev/dashboard/billing` and requires authentication with `billing:read` scope (or `billing:admin` for write operations)
- [ ] **Usage Dashboard**: displays real-time usage charts (line graphs) for each metered dimension — inference calls, API calls, bandwidth, GPU-hours, active cameras, storage — with daily/weekly/monthly granularity toggles
- [ ] **Usage Dashboard**: shows current-period usage vs. plan limits as progress bars with color coding (green < 50%, yellow 50-80%, orange 80-100%, red > 100% / overage)
- [ ] **Subscription Management**: displays current plan, billing cycle, next renewal date, and a "Change Plan" button that shows plan comparison (story 172) and handles upgrades/downgrades
- [ ] **Payment Methods**: lists saved payment methods (Stripe `PaymentMethod` objects — card brand, last 4 digits, expiry) with add/remove/set-default actions — powered by Stripe Elements for PCI compliance
- [ ] **Invoice History**: paginated table of invoices with columns: Invoice #, Date, Amount, Status (badge), Actions (View, Download PDF) — links to the invoice detail view and PDF download (story 174)
- [ ] **Invoice Detail View**: shows all line items grouped by category (Inference, Cameras, Bandwidth, GPU, Storage) with subtotals, credits, tax, and total
- [ ] **Quota Management**: displays current quotas per dimension with usage gauges, and allows admins to adjust soft/hard limits inline (calls story 175 API)
- [ ] **Overage Policy Configuration**: per-dimension policy selector (block/throttle/charge/notify) with inline configuration of overage rate and max spend (calls story 178 API)
- [ ] **Cost Projections**: based on trailing 7-day usage trends, shows projected end-of-month cost with confidence intervals — warns if projected cost exceeds a configurable alert threshold
- [ ] **Usage Alerts**: UI to configure email/webhook notifications at custom usage thresholds (e.g., "Email me when inference calls reach 80% of limit")
- [ ] **Billing Contacts**: manage who receives invoice emails, payment failure notifications, and usage alerts — supports multiple email addresses per notification type
- [ ] **Audit Log**: displays a chronological log of billing events — plan changes, payment attempts, quota changes, overage events — with actor, timestamp, and details
- [ ] All portal actions that modify billing state show a confirmation dialog before execution

### Edge Cases

- [ ] Portal loads with Stripe Elements but Stripe.js fails to load (CDN outage): the payment method section shows a fallback message: "Payment management is temporarily unavailable. Try again shortly or contact support." — other portal sections remain functional
- [ ] Admin tries to remove the only payment method while on a paid plan: rejected with an inline error: "Cannot remove the only payment method on a paid plan. Add a new payment method first or downgrade to Free."
- [ ] Usage dashboard with no usage data (new tenant): charts display "No usage data yet — start using OpenEye to see your consumption patterns here" instead of empty graphs
- [ ] Invoice PDF download for a very old invoice (>12 months): the PDF may need to be regenerated from stored data — the portal shows a loading spinner during generation and caches the result
- [ ] Session timeout while filling out a form (e.g., changing plan): the portal preserves form state in `localStorage` and restores it after re-authentication — no data loss on session expiry
- [ ] Multiple admins editing quota limits simultaneously: the portal uses optimistic concurrency — if the quota was modified by another admin since page load, the save fails with "This quota was updated by another admin. Please refresh and try again."
- [ ] Cost projection for a tenant with highly variable usage (e.g., batch processing spikes): the projection shows min/max bounds alongside the median projection, with a note: "Usage varies significantly — projection may be inaccurate"
- [ ] Portal accessed on mobile: the layout is responsive with a collapsible sidebar, stacked cards for usage gauges, and simplified charts — all functionality is preserved
- [ ] Stripe Billing Portal redirect: "Manage payment methods" can optionally redirect to Stripe's hosted Billing Portal (story 173) via `POST /api/v1/billing/portal` — configured via `BILLING_PORTAL_MODE=embedded|stripe`
- [ ] Browser back button after a successful plan change: the portal prevents re-submission by checking the subscription's `updated_at` timestamp — shows "Plan already changed" instead of reprocessing
- [ ] Accessibility: all interactive elements have ARIA labels, the usage charts include tabular data fallbacks for screen readers, and color coding is supplemented with icons/patterns for color-blind users
- [ ] XSS via invoice line item descriptions: project/model names rendered in portal without sanitization — stored XSS vulnerability
- [ ] CSRF on billing state-changing operations: plan changes, quota updates, payment method changes lack CSRF protection
- [ ] PCI/CSP for Stripe Elements: compromised npm dependency could exfiltrate card data from Stripe iframes — no CSP headers or SRI for Stripe.js

### Technical Notes

- The billing portal is a React SPA within the existing dashboard (story 179 is under `src/pages/dashboard/billing/`)
- Components: `UsageDashboard.tsx`, `SubscriptionManager.tsx`, `PaymentMethods.tsx`, `InvoiceHistory.tsx`, `QuotaManager.tsx`, `OverageConfig.tsx`, `CostProjection.tsx`, `BillingAuditLog.tsx`
- Payment methods use Stripe Elements (`@stripe/react-stripe-js`) embedded in the portal — card data never touches the OpenEye backend (PCI SAQ-A compliance)
- Usage charts use a charting library (Recharts or similar) with data from `GET /api/v1/usage/history` (story 171)
- Real-time usage updates use a WebSocket connection to `ws://api.openeye.dev/ws/usage` that pushes updated counters every 30 seconds
- The audit log queries `GET /api/v1/billing/audit-log?tenant_id=<id>&limit=50&offset=0`

---

## 180. Revenue Analytics & Reporting

**As a member of the business team, I get analytics on MRR, ARR, churn, expansion revenue, ARPU, and cohort analysis so I can track business health and make data-driven pricing decisions.**

### Acceptance Criteria

- [ ] `GET /api/v1/analytics/revenue/mrr` returns current Monthly Recurring Revenue with breakdown: new MRR, expansion MRR (upgrades + overage), contraction MRR (downgrades), churned MRR, and net new MRR
- [ ] `GET /api/v1/analytics/revenue/arr` returns Annualized Recurring Revenue (MRR x 12) with trailing-12-month trend
- [ ] `GET /api/v1/analytics/revenue/churn?period=monthly` returns customer churn rate (logo churn) and revenue churn rate (dollar churn) for the specified period, with gross and net churn (net = gross - expansion)
- [ ] `GET /api/v1/analytics/revenue/arpu?segment=plan` returns Average Revenue Per User (total revenue / active customers), segmentable by plan tier, industry, company size, or region
- [ ] `GET /api/v1/analytics/revenue/cohorts?cohort_by=signup_month&metric=retention` returns cohort analysis with retention curves — each cohort row shows the percentage of customers still active after N months
- [ ] `GET /api/v1/analytics/revenue/cohorts?cohort_by=signup_month&metric=revenue` returns revenue cohort analysis — shows average revenue per cohort over time (expansion visibility)
- [ ] `GET /api/v1/analytics/revenue/ltv?segment=plan` returns estimated Customer Lifetime Value by segment, calculated as ARPU / monthly churn rate
- [ ] `GET /api/v1/analytics/revenue/overview` returns a comprehensive dashboard payload: MRR, ARR, total customers, paid customers, free customers, trialing customers, MRR growth rate, net revenue retention (NRR), quick ratio ((new + expansion) / (contraction + churn))
- [ ] All analytics endpoints accept `from` and `to` date parameters for historical analysis and support `granularity=daily|weekly|monthly`
- [ ] Revenue analytics dashboard at `https://app.openeye.dev/dashboard/analytics/revenue` visualizes all metrics with interactive charts (line charts for trends, bar charts for composition, heatmaps for cohorts)
- [ ] Dashboard includes a "Revenue Waterfall" chart showing MRR movement: starting MRR + new + expansion - contraction - churn = ending MRR
- [ ] CSV/JSON export for all analytics data: `GET /api/v1/analytics/revenue/mrr?format=csv` returns downloadable CSV
- [ ] All analytics endpoints require `analytics:read` scope — restricted to internal business team roles, not tenant admins
- [ ] Analytics data is refreshed hourly from the billing database — a `last_updated_at` timestamp is included in every response

### Edge Cases

- [ ] Tenant with mid-month plan change: MRR contribution is calculated as the prorated monthly value at each point in time — e.g., upgrading from $100/mo Pro to $500/mo Enterprise on the 15th counts as $100 MRR for the first half and $500 MRR for the second half, with the change attributed to "expansion MRR"
- [ ] Annual subscription MRR calculation: an annual $6,000 subscription contributes $500/month to MRR — the full annual amount is NOT counted as a single month's revenue
- [ ] Churned customer who reactivates: counted as "new MRR" (not "recovered MRR") in the reactivation month if the gap was >3 months. If reactivated within 3 months, it is classified as "recovered MRR" and separated from new customer MRR
- [ ] Free tier users in metrics: excluded from ARPU and churn calculations by default. `?include_free=true` includes them, which significantly changes ARPU and churn numbers — the API response includes a `note` field explaining the impact
- [ ] Trial users: counted as "trialing" in the overview but excluded from MRR until they convert. Upon conversion, the revenue is attributed to "new MRR" in the conversion month
- [ ] Cohort analysis with small cohorts (<5 customers): retention percentages can be misleading (one customer = 20% swing). The API includes `cohort_size` in each row and flags cohorts where `cohort_size < 10` with `"low_confidence": true`
- [ ] Revenue from overage charges (story 178): classified as "expansion MRR" if recurring month-over-month, or as "one-time revenue" if sporadic — the classification uses a 3-month lookback to determine recurrence
- [ ] Currency normalization: all revenue metrics are reported in USD. For tenants billed in other currencies, the exchange rate at the time of each invoice is used — not the current rate — to avoid retroactive revenue fluctuations
- [ ] Data backfill: if the analytics system is deployed after the platform has been running for months, a backfill job processes historical `invoices` and `subscription_events` tables to reconstruct MRR history. `GET /api/v1/analytics/revenue/mrr?from=2025-01-01` returns backfilled data with a `"backfilled": true` flag
- [ ] Zero-revenue month: the API returns `{"mrr": 0, "arr": 0, ...}` with all fields present (not `null` or missing) so dashboards render correctly without special-casing
- [ ] LTV calculation with negative churn (NRR > 100%): LTV is capped at 10-year horizon to avoid infinite/unrealistic projections when expansion exceeds churn — the response includes `"ltv_capped": true` and the raw formula result
- [ ] Refund impact on MRR: refunds should reduce MRR or classify as contraction — no mention of refund flow to revenue analytics
- [ ] Revenue recognition timing (ASC 606): should metered revenue be recognized when billed, collected, or delivered — matters for SOX compliance
- [ ] Credit notes impact: credit notes reduce invoice amounts but not reflected in MRR/ARR/NRR calculations

### Technical Notes

- Analytics queries run against a read replica of the billing database to avoid impacting production write performance
- Revenue calculations live in `backend/analytics/revenue.py` with helper functions: `calculate_mrr()`, `calculate_churn()`, `build_cohorts()`, `calculate_arpu()`, `calculate_ltv()`
- The cohort analysis uses the `subscriptions` table's `created_at` as the cohort date and joins with `invoices` for revenue data
- MRR is calculated by summing `(plan.monthly_price + avg_monthly_overage)` across all active subscriptions — stored in `mrr_snapshots` table with daily granularity
- Net Revenue Retention (NRR) = (starting MRR + expansion - contraction - churn) / starting MRR x 100 — calculated monthly
- Quick ratio = (new MRR + expansion MRR) / (contraction MRR + churned MRR) — a ratio > 4 indicates healthy growth
- The analytics dashboard is a React SPA at `src/pages/dashboard/analytics/Revenue.tsx` using Recharts for visualizations
- Cohort heatmap uses a color scale from red (0% retention) to green (100% retention) with the exact percentage displayed in each cell
- CSV export uses streaming response to handle large date ranges without memory issues
