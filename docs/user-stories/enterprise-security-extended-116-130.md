# Enterprise Security & Compliance Extended (116–130)

---

## 116. SCIM User Provisioning

**As an enterprise admin, I can auto-provision and deprovision users from my Identity Provider (Okta, Azure AD, OneLogin) via the SCIM 2.0 protocol so that user lifecycle is managed centrally.**

### Acceptance Criteria

- [ ] OpenEye exposes a SCIM 2.0-compliant endpoint at `/scim/v2/` on the management API (`openeye serve --enable-scim`)
- [ ] `POST /scim/v2/Users` creates a new OpenEye user with `userName`, `displayName`, `emails`, `active`, and `roles` mapped from the SCIM payload
- [ ] `PATCH /scim/v2/Users/{id}` updates user attributes — including `active: false` to deactivate a deprovisioned user
- [ ] `DELETE /scim/v2/Users/{id}` soft-deletes the user (retains audit logs for 90 days per story 124), revokes all active sessions and API keys immediately
- [ ] `GET /scim/v2/Users` supports filtering (`?filter=userName eq "jane@corp.com"`), pagination (`startIndex`, `count`), and returns `ListResponse` per RFC 7644
- [ ] `GET /scim/v2/Groups` and `POST /scim/v2/Groups` support syncing IdP groups to OpenEye roles (`admin`, `operator`, `viewer`, `security-analyst`)
- [ ] Group membership changes in the IdP propagate to OpenEye role assignments within the SCIM sync interval (typically 30–60 minutes, IdP-dependent)
- [ ] SCIM bearer token authentication is required: `--scim-token` or `OPENEYE_SCIM_TOKEN` env var — tokens are generated via `openeye admin scim-token generate`
- [ ] SCIM token supports rotation: `openeye admin scim-token rotate --grace-period 24h` keeps the old token valid during the grace window
- [ ] Schema discovery endpoint at `/scim/v2/Schemas` and `/scim/v2/ServiceProviderConfig` returns OpenEye's supported SCIM attributes and capabilities
- [ ] Custom SCIM attribute extension (`urn:openeye:scim:1.0:User`) maps IdP custom attributes to OpenEye-specific fields: `defaultProject`, `cameraGroupAccess`, `maxApiKeys`
- [ ] SCIM provisioning events are logged to the audit trail (story 124) with `actor: scim-provider`, `action: user.created|user.updated|user.deprovisioned`
- [ ] Integration is tested and documented for Okta, Azure AD (Entra ID), OneLogin, and JumpCloud SCIM connectors

### Edge Cases

- [ ] Duplicate `userName` on `POST /scim/v2/Users`: returns `409 Conflict` with a `scimType: uniqueness` error per RFC 7644 — does not silently overwrite the existing user
- [ ] IdP sends a `PATCH` with an unsupported attribute (e.g., `nickName`): returns `200 OK` and ignores the unsupported field — logs a debug-level message listing ignored attributes
- [ ] Deprovisioned user attempts to authenticate: returns `403 Forbidden` with `{"error": "account_deactivated", "message": "Contact your administrator"}` — does not reveal whether the account exists
- [ ] Rapid deprovision-then-reprovision (user removed and re-added in IdP within minutes): the soft-deleted user record is reactivated rather than creating a duplicate — detection is based on `userName` + `externalId` match
- [ ] SCIM token expiry during an active sync batch: the IdP receives `401 Unauthorized` on the next request — IdP retries are expected. The in-progress batch is not partially applied
- [ ] IdP sends a bulk operation (`/scim/v2/Bulk`) with 500+ users: operations are processed sequentially with a configurable rate limit (`--scim-bulk-rate-limit`, default: 50/s) to avoid overwhelming the database. Response includes per-operation status
- [ ] Group with >1000 members: paginated `GET /scim/v2/Groups/{id}` with `members` attribute returns paginated member lists — does not attempt to serialize all members in a single response
- [ ] SCIM endpoint is unavailable (OpenEye server restart): IdP retries with its own backoff policy. When the endpoint recovers, all pending changes are applied idempotently via `externalId` matching
- [ ] Concurrent SCIM writes to the same user (e.g., IdP sends two rapid `PATCH` requests): the second request uses optimistic locking (ETag/`meta.version`) — returns `412 Precondition Failed` if the record was modified between reads
- [ ] Malformed SCIM payload (missing required `userName` field): returns `400 Bad Request` with `scimType: invalidValue` and a description of the missing field — does not create a partial user record
- [ ] SCIM filter injection: attacker crafts a malicious `filter` parameter (e.g., `userName eq "x" OR 1=1`) to enumerate users — filter parser must reject non-standard operators and limit result sets
- [ ] Cross-tenant SCIM isolation: in multi-tenant deployments, a SCIM token from Tenant A must not provision users in Tenant B — ensure token scope is bound to a specific tenant
- [ ] SCIM token brute-force: no rate limiting on the SCIM endpoint for failed bearer token attempts — add per-IP rate limit on 401 responses

### Technical Notes

- SCIM server implementation lives in `backend/scim/` with `users.py`, `groups.py`, `schemas.py`, `filters.py`
- SCIM filter parsing uses a custom parser for the SCIM filter syntax (`eq`, `ne`, `co`, `sw`, `ew`, `gt`, `lt`, `and`, `or`)
- User storage maps to the existing `users` table with an additional `scim_external_id` column for IdP correlation
- The SCIM endpoint shares the management API auth middleware but adds a separate SCIM-specific token validation layer
- SCIM attribute mapping is configurable via `~/.openeye/scim-mapping.yaml` for non-standard IdP attribute names
- References story 117 for MFA enrollment status syncing and story 118 for service account exclusion from SCIM sync

---

## 117. Multi-Factor Authentication (MFA)

**As a user, I can enable TOTP, WebAuthn/FIDO2, or SMS-based MFA for API and dashboard access so that my account is protected against credential theft.**

### Acceptance Criteria

- [ ] `openeye auth mfa enable --method totp` generates a TOTP secret, displays a QR code (terminal-rendered via `qrcode` library) and a manual entry key, and prompts for a verification code to confirm enrollment
- [ ] `openeye auth mfa enable --method webauthn` initiates a WebAuthn/FIDO2 registration ceremony — supports hardware keys (YubiKey), platform authenticators (Touch ID, Windows Hello), and passkeys
- [ ] `openeye auth mfa enable --method sms --phone +1555123456` registers a phone number for SMS-based OTP delivery via Twilio or AWS SNS (`--sms-provider twilio|sns`)
- [ ] Dashboard login at `/login` prompts for MFA after successful password/SSO authentication — the MFA challenge is rendered as a second step, not a separate page redirect
- [ ] API authentication with MFA: `POST /auth/token` returns a `mfa_required: true` response with a `mfa_token` (short-lived, 5 min). The client then calls `POST /auth/mfa/verify` with the `mfa_token` + OTP code to receive the full access token
- [ ] `openeye auth mfa status` shows enrolled methods, recovery codes remaining, and last MFA verification timestamp
- [ ] Recovery codes: 10 single-use backup codes are generated at enrollment, displayed once, and accepted in place of any MFA method. `openeye auth mfa recovery regenerate` issues new codes (invalidates old ones)
- [ ] Enterprise admins can enforce MFA for all users: `openeye admin mfa enforce --grace-period 7d` — users without MFA are prompted on every login during the grace period, then locked out
- [ ] MFA enforcement policy is configurable per role: `--enforce-roles admin,operator` allows `viewer` users to remain without MFA
- [ ] `openeye auth mfa disable --method totp` removes a specific MFA method (requires current MFA verification to disable). Cannot disable the last remaining method if MFA enforcement is active
- [ ] WebAuthn supports multiple registered keys per user — `openeye auth mfa list` shows all registered authenticators with name, registration date, and last used timestamp
- [ ] TOTP implementation follows RFC 6238 with a 30-second time step and SHA-1 HMAC (compatible with Google Authenticator, Authy, 1Password)
- [ ] MFA events are logged to the audit trail: `mfa.enrolled`, `mfa.verified`, `mfa.failed`, `mfa.disabled`, `mfa.recovery_used`

### Edge Cases

- [ ] TOTP clock skew: accepts codes from the previous and next 30-second window (total window: 90 seconds) to account for client clock drift — configurable via `--totp-skew-windows` (default: 1)
- [ ] TOTP code replay: each TOTP code can only be used once within its validity window — a second attempt with the same code returns `403 Forbidden` with `{"error": "code_already_used"}`
- [ ] WebAuthn registration with an unsupported browser: if the browser does not support WebAuthn, the dashboard falls back to showing TOTP enrollment with a message: "Your browser does not support security keys. Please use an authenticator app instead."
- [ ] SMS delivery failure: if the SMS provider returns a delivery error (invalid number, carrier block), returns `502 Bad Gateway` with `{"error": "sms_delivery_failed"}` and suggests trying an authenticator app
- [ ] SMS rate limiting: maximum 5 SMS OTP requests per phone number per 10 minutes — exceeding returns `429 Too Many Requests` with a `retry_after` field
- [ ] All recovery codes exhausted: user is instructed to contact an admin. Admin can issue a temporary bypass via `openeye admin mfa bypass --user jane@corp.com --duration 1h --reason "lost device"` (logged to audit trail)
- [ ] MFA enforcement with SCIM-provisioned users (story 116): newly provisioned users are given the grace period from their creation date, not from the enforcement activation date
- [ ] User has TOTP and WebAuthn enrolled — loses both devices: recovery code flow is the only path. If recovery codes are also lost, the admin bypass flow is required
- [ ] Brute-force protection: 5 consecutive failed MFA attempts lock the MFA verification for 15 minutes. The lockout counter resets on successful verification. Lockout events are logged to the audit trail
- [ ] WebAuthn with platform authenticator on a shared workstation: the authenticator is bound to the hardware — `openeye auth mfa list` shows the authenticator's AAGUID so the user can identify which device it belongs to
- [ ] MFA during CI/CD: service accounts (story 118) are exempt from MFA enforcement by default. `--enforce-service-accounts` overrides this, requiring TOTP-based verification for service account token refresh
- [ ] MFA bypass token theft: the `mfa_token` (5 min TTL) returned after password auth is a bearer token — if stolen, attacker can attempt MFA brute-force. Bind token to originating IP and user-agent
- [ ] MFA downgrade attack: if user has WebAuthn enrolled, MFA challenge must not be downgradable to SMS by parameter manipulation
- [ ] Session fixation after MFA: after successful MFA verification, the session token must be regenerated — do not promote pre-MFA session
- [ ] SMS interception (SIM swap): no guidance on deprecating SMS as standalone MFA for high-privilege accounts — require WebAuthn or TOTP for admin roles

### Technical Notes

- TOTP implementation uses `pyotp` library for secret generation and code verification
- WebAuthn server-side uses `py-webauthn` (fido2) library for registration and authentication ceremonies
- SMS delivery uses `twilio` or `boto3` (SNS) — optional dependencies: `pip install openeye-sh[mfa-sms]`
- MFA state is stored in the `user_mfa` table with columns: `user_id`, `method`, `secret_encrypted`, `credential_id` (WebAuthn), `created_at`, `last_used_at`
- Recovery codes are stored as bcrypt hashes — the plaintext is shown exactly once at generation
- WebAuthn challenge storage uses a short-lived server-side session (Redis or in-memory with 5 min TTL)
- MFA logic lives in `backend/auth/mfa/` with `totp.py`, `webauthn.py`, `sms.py`, `recovery.py`
- References story 116 (SCIM) for user lifecycle and story 118 (service accounts) for MFA exemption policies

---

## 118. Service Account Management

**As an enterprise admin, I can create non-human service accounts with limited scopes for CI/CD pipelines and automation so that machine-to-machine integrations do not require personal user credentials.**

### Acceptance Criteria

- [ ] `openeye admin service-account create --name "ci-pipeline" --scopes predict,models.list --expires 90d` creates a service account and outputs an API key
- [ ] Service accounts are distinct from user accounts — they appear in `openeye admin service-account list` separately from `openeye admin user list`
- [ ] Scopes are granular and follow `resource.action` format: `predict`, `predict.batch`, `models.list`, `models.pull`, `cameras.read`, `cameras.write`, `webhooks.manage`, `admin.read`, `admin.write`, `stream`
- [ ] `--expires` sets an absolute expiration date on the service account key. Expired keys return `401 Unauthorized` with `{"error": "key_expired", "expired_at": "..."}`
- [ ] `openeye admin service-account rotate-key --name "ci-pipeline" --grace-period 24h` generates a new key and keeps the old key valid during the grace period
- [ ] `openeye admin service-account disable --name "ci-pipeline"` immediately revokes all keys and blocks authentication — reversible with `enable`
- [ ] `openeye admin service-account delete --name "ci-pipeline" --confirm` permanently removes the service account (audit log retained per story 124)
- [ ] Service account API keys use a distinct prefix: `sa-openeye-...` (vs `sk-openeye-...` for user keys) for easy identification in logs and secret scanners
- [ ] IP allowlisting per service account: `--allowed-ips 10.0.0.0/8,172.16.0.0/12` restricts API access to specific CIDR ranges. Requests from non-allowed IPs return `403 Forbidden`
- [ ] Rate limiting per service account: `--rate-limit 1000/min` overrides the global rate limit for this account. Default inherits the server's global limit
- [ ] Service account activity is logged to the audit trail with `actor_type: service_account` and `actor_name: ci-pipeline`
- [ ] `openeye admin service-account audit --name "ci-pipeline" --last 30d` shows all API calls made by the service account with endpoint, timestamp, source IP, and response status
- [ ] Service accounts are excluded from SCIM sync (story 116) — they are not managed by the IdP
- [ ] Maximum service accounts per organization is configurable: `--max-service-accounts` (default: 100)

### Edge Cases

- [ ] Service account name collision: `create` with an existing name returns `409 Conflict` with the existing account's creation date — does not overwrite
- [ ] Service account key displayed only once at creation: if the admin loses the key, they must rotate to generate a new one. `openeye admin service-account show --name "ci-pipeline"` shows metadata but never the key
- [ ] Scope validation: `--scopes nonexistent.scope` returns a clear error listing all valid scopes — does not create the service account with invalid scopes
- [ ] Service account attempts to access an out-of-scope endpoint: returns `403 Forbidden` with `{"error": "insufficient_scope", "required": "models.pull", "granted": ["predict", "models.list"]}`
- [ ] Key rotation during active requests: in-flight requests using the old key complete successfully. New requests during the grace period accept both old and new keys
- [ ] Expired key with grace period: `--expires 90d` on the key itself vs `--grace-period 24h` on rotation are independent. A rotated key's grace period does not extend past the account's absolute expiry
- [ ] Service account with `admin.write` scope: requires the creating admin to have `super-admin` role — regular admins cannot grant `admin.*` scopes to service accounts
- [ ] Bulk service account creation via API: `POST /admin/service-accounts/bulk` accepts an array (max 50) and returns per-account results — partial failures do not roll back successful creates
- [ ] IP allowlist with IPv6: supports both IPv4 and IPv6 CIDR notation. `::1` is treated as localhost. Mixed IPv4/IPv6 lists are supported
- [ ] Service account hitting rate limit: returns `429 Too Many Requests` with `X-RateLimit-Reset` header. The response body includes the service account name and configured limit for debugging
- [ ] Deleting a service account that is referenced in webhook configs (story 195) or sink credentials: deletion proceeds but a warning lists the affected integrations that will stop working
- [ ] Service account key in logs: API requests include key in Authorization header — ensure log middleware redacts full key, logging only `sa-openeye-` prefix + first 8 chars
- [ ] Privilege escalation via bulk create: `POST /admin/service-accounts/bulk` must apply per-account scope validation to every item, not just the first
- [ ] Rate limit bypass via key rotation: if counter is keyed on key hash rather than account ID, rotating the key resets the rate limit window

### Technical Notes

- Service account storage in `service_accounts` table with columns: `id`, `name`, `org_id`, `scopes` (JSON array), `allowed_ips` (CIDR array), `rate_limit`, `created_by`, `created_at`, `expires_at`, `disabled_at`
- API key storage in `service_account_keys` table: `id`, `account_id`, `key_hash` (bcrypt), `key_prefix` (first 8 chars for identification), `created_at`, `expires_at`, `revoked_at`
- Scope enforcement is implemented as FastAPI middleware that checks the `service_account.scopes` against a per-route scope requirement decorator
- Service account logic lives in `backend/auth/service_accounts.py`
- Key format: `sa-openeye-<32 random alphanumeric chars>` (total: 44 chars)
- References story 117 for MFA exemption defaults and story 119 for automatic key rotation schedules

---

## 119. Secrets Rotation Automation

**As a platform operator, I can configure OpenEye to automatically rotate internal secrets (database passwords, JWT signing keys, API encryption keys, internal service tokens) on a schedule so that credential exposure windows are minimized.**

### Acceptance Criteria

- [ ] `openeye admin secrets rotation configure --type db-password --interval 30d --strategy rolling` enables automatic rotation of the PostgreSQL database password
- [ ] `openeye admin secrets rotation configure --type jwt-signing-key --interval 7d --strategy dual-active` rotates JWT signing keys with dual-key validation during transition
- [ ] `openeye admin secrets rotation configure --type encryption-key --interval 90d --strategy envelope` rotates the AES-256 data-at-rest encryption key using envelope encryption (re-wraps DEKs, does not re-encrypt all data)
- [ ] `openeye admin secrets rotation configure --type internal-token --interval 24h --strategy immediate` rotates internal service-to-service authentication tokens
- [ ] Rotation strategies: `rolling` (old + new valid during grace period), `dual-active` (both keys active for signing/verification), `immediate` (old invalidated instantly), `envelope` (re-wrap only)
- [ ] `openeye admin secrets rotation status` shows each secret type, last rotation timestamp, next scheduled rotation, and current strategy
- [ ] `openeye admin secrets rotation trigger --type jwt-signing-key --reason "suspected compromise"` forces an immediate out-of-cycle rotation
- [ ] Rotation events integrate with external secrets managers (story 199): rotated values are pushed to Vault/AWS Secrets Manager/Azure Key Vault
- [ ] Pre-rotation hooks: `--pre-rotate-hook /path/to/script.sh` runs a validation script before committing the new secret — if the hook exits non-zero, rotation is aborted and an alert is sent
- [ ] Post-rotation hooks: `--post-rotate-hook /path/to/notify.sh` runs after successful rotation — useful for notifying dependent services
- [ ] Rotation schedule uses cron syntax for fine-grained control: `--schedule "0 2 * * 0"` (every Sunday at 2 AM) as an alternative to `--interval`
- [ ] All rotation events are logged to the audit trail: `secret.rotation.scheduled`, `secret.rotation.started`, `secret.rotation.completed`, `secret.rotation.failed`
- [ ] Configuration is stored in `~/.openeye/rotation-config.yaml` and can be managed via the API: `GET/PUT /admin/secrets/rotation`

### Edge Cases

- [ ] Database password rotation while active connections exist: the `rolling` strategy creates the new password in the database first, then updates the application config, then revokes the old password after `--grace-period` (default: 1h). Active connection pools are drained gracefully
- [ ] JWT signing key rotation with outstanding tokens: `dual-active` keeps both old and new keys in the verification JWKS (`/.well-known/jwks.json`). Tokens signed with the old key remain valid until their natural expiry (`exp` claim). New tokens use the new key immediately
- [ ] Rotation fails mid-process (e.g., database unreachable during password change): the rotation is rolled back to the previous secret, a `secret.rotation.failed` event is logged, and a retry is scheduled in 15 minutes (max 3 retries before alerting)
- [ ] Envelope key rotation with large volumes of DEKs (>100,000): re-wrapping is batched (`--rewrap-batch-size`, default: 1000) and runs as a background job — does not block the API. Progress is reported via `openeye admin secrets rotation status`
- [ ] Concurrent rotation triggers (scheduled + manual): the second trigger detects an in-progress rotation and queues behind it — does not create a race condition
- [ ] External secrets manager is unavailable during rotation: the new secret is applied locally and queued for push to the external manager. A warning is logged until the push succeeds
- [ ] Clock skew on multi-node deployments: rotation scheduling uses the database as the coordination source (advisory locks) — only one node executes the rotation
- [ ] Pre-rotation hook timeout: hooks have a configurable timeout (`--hook-timeout`, default: 30s). Timed-out hooks are treated as failures — rotation is aborted
- [ ] Rotation of encryption keys with data in multiple storage backends (local disk, S3, database): each backend's DEKs are re-wrapped independently. If one backend fails, others proceed — partial progress is checkpointed
- [ ] Service accounts (story 118) using API keys during rotation: service account keys are not rotated by this system — they have their own rotation lifecycle. This system only rotates platform-internal secrets
- [ ] Downgrade scenario: if the application is rolled back to a version that doesn't understand the new key format, the `rolling` strategy ensures the old-format secret is preserved during the grace period
- [ ] Rotation hook command injection: `--pre-rotate-hook` and `--post-rotate-hook` paths could be manipulated — validate hooks are executable files owned by the system user, not world-writable
- [ ] Secrets in core dumps: if process crashes during rotation, secret values may be in core dumps — set `RLIMIT_CORE` to 0 or use `madvise(MADV_DONTDUMP)`
- [ ] Race between rotation and backup (story 129): backup capturing database mid-rotation could leave restored system in inconsistent auth state — rotation should acquire a backup-aware lock

### Technical Notes

- Rotation engine lives in `backend/secrets/rotation/` with `engine.py`, `strategies.py`, `hooks.py`, `scheduler.py`
- Database password rotation uses `ALTER USER ... PASSWORD ...` via a privileged connection separate from the application pool
- JWT key rotation uses RSA-2048 or ES256 keys stored in `~/.openeye/keys/` with JWKS published at `/.well-known/jwks.json`
- Envelope encryption: KEK (Key Encryption Key) wraps per-record DEKs (Data Encryption Keys). Rotation re-wraps DEKs with the new KEK without touching ciphertext
- Scheduler uses APScheduler or a lightweight cron-like loop — does not depend on system cron
- Coordination across multi-node deployments uses PostgreSQL advisory locks (`pg_advisory_lock`)
- References story 199 for external secrets manager push and story 118 for service account key distinction

### Example Config

```yaml
# ~/.openeye/rotation-config.yaml
rotation:
  db-password:
    interval: 30d
    strategy: rolling
    grace_period: 1h
    pre_rotate_hook: /opt/openeye/hooks/validate-db.sh
    post_rotate_hook: /opt/openeye/hooks/notify-slack.sh
    external_push:
      - vault:secret/data/openeye/db

  jwt-signing-key:
    interval: 7d
    strategy: dual-active
    algorithm: ES256
    key_size: 256

  encryption-key:
    interval: 90d
    strategy: envelope
    rewrap_batch_size: 1000

  internal-token:
    schedule: "0 */6 * * *"  # every 6 hours
    strategy: immediate
```

---

## 120. Data Classification & DLP

**As an enterprise admin, I can classify detection data by sensitivity level and enforce data loss prevention (DLP) policies so that sensitive detection data is handled according to organizational data governance requirements.**

### Acceptance Criteria

- [ ] Data classification levels are configurable: `openeye admin dlp levels set --levels public,internal,confidential,restricted` (default: `public`, `internal`, `confidential`, `restricted`)
- [ ] Detection data auto-classification rules: `openeye admin dlp rule create --name "face-restricted" --condition "label:person AND confidence_gte:0.8" --level restricted` — detections matching the rule are tagged with the specified classification level
- [ ] Camera-level classification: `openeye admin dlp camera classify --camera warehouse-cam-01 --level internal` — all detections from this camera inherit at minimum the camera's classification level (highest wins if a rule also matches)
- [ ] Zone-level classification: detection zones (story 195) can have a classification level — detections within restricted-classified zones are auto-classified as `restricted`
- [ ] DLP policy enforcement: `openeye admin dlp policy create --level restricted --actions "block-export,redact-api,encrypt-at-rest,audit-access"`
- [ ] `block-export`: prevents export of restricted data via `--export` (story 89), webhooks (story 195), or data lake sinks (story 196). Export attempts return `403` with the DLP policy name
- [ ] `redact-api`: API responses for restricted data replace frame snapshots with a redacted placeholder and strip GPS coordinates
- [ ] `encrypt-at-rest`: restricted data is encrypted with a separate encryption key (distinct from the default; see story 119)
- [ ] `audit-access`: every read access to restricted data is logged to the audit trail with the accessor's identity, timestamp, and access method
- [ ] `openeye admin dlp status` shows current classification distribution (count of records per level), active policies, and recent policy violations
- [ ] DLP policies are evaluated in real-time during detection — classification labels are attached to `PredictionResult.metadata.classification_level`
- [ ] Data classification labels propagate to downstream sinks: Kafka messages (story 193), Snowflake rows (story 196), and webhook payloads (story 195) include the classification level
- [ ] `openeye admin dlp export-policy --format json` exports all rules and policies for backup or cross-environment replication

### Edge Cases

- [ ] Classification level conflict: a detection matches two rules with different levels (e.g., `internal` from camera, `restricted` from content rule) — the highest level wins. The applied level and all contributing rules are logged in metadata
- [ ] Retroactive reclassification: `openeye admin dlp reclassify --rule-id <id> --apply-retroactive` re-evaluates stored detections against the new rule. This is a background job that reports progress — does not block the pipeline
- [ ] DLP policy blocks a webhook delivery: the webhook engine (story 195) receives a `DLPBlockError`, logs the blocked event with the policy name, and does not retry — the block is intentional
- [ ] User with `admin.read` scope queries restricted data: access is granted but `audit-access` logs every record accessed. Non-admin users querying restricted data receive `403 Forbidden`
- [ ] Bulk export request contains a mix of classification levels: items at or below the requester's clearance are included; items above are replaced with `{"redacted": true, "reason": "dlp_policy", "classification": "restricted"}` — the response still returns 200 with partial results
- [ ] Classification rule referencing a label that no loaded model produces: the rule is accepted and stored (models may change), but `openeye admin dlp validate` warns about unmatched rules
- [ ] DLP policy with `encrypt-at-rest` applied to data already encrypted with the default key: data is re-encrypted with the restricted key during the next scheduled encryption key rotation (story 119) — not re-encrypted immediately to avoid I/O storms
- [ ] Data sovereignty intersection (story 125): if a detection is classified `restricted` AND has a data residency constraint, both policies must be satisfied — DLP does not override residency
- [ ] Misconfigured classification (no rules, everything defaults to `public`): `openeye admin dlp audit` warns about unclassified data volumes exceeding a threshold (`--unclassified-alert-pct`, default: 80%)
- [ ] Performance impact: classification rule evaluation adds <1ms per frame. Rules are compiled to an in-memory decision tree at startup — `openeye admin dlp rule create` triggers a hot-reload of the rule engine
- [ ] DLP rule bypass via metadata manipulation: if classification is based on detection `confidence_gte`, a compromised model lowering confidence bypasses classification — validate classification cannot be circumvented by model output
- [ ] DLP policy evaluated after data already written: if classification engine has startup delay, frames may be stored without classification — define fail-closed behavior for unclassified frames
- [ ] Export via side channel: DLP blocks exports/webhooks/sinks but does not mention blocking data access via SCIM API, compliance reports, or SIEM events — enumerate all data egress paths

### Technical Notes

- DLP engine lives in `backend/dlp/` with `classifier.py`, `policies.py`, `rules.py`, `enforcement.py`
- Classification rules use a DSL similar to webhook rules (story 195) — parsed by the same rule engine
- Classification levels are stored in the `dlp_levels` table; rules in `dlp_rules`; policies in `dlp_policies`
- Each `PredictionResult` gains a `metadata.dlp` object: `{"classification": "restricted", "rules_matched": ["face-restricted"], "policy_actions": ["encrypt-at-rest", "audit-access"]}`
- DLP configuration API: `GET/POST/PUT/DELETE /admin/dlp/rules`, `/admin/dlp/policies`, `/admin/dlp/levels`
- References story 121 for PII-specific redaction, story 124 for compliance reporting of DLP violations, story 125 for data residency interactions

---

## 121. PII Detection & Redaction

**As an enterprise privacy officer, I can auto-detect and redact personally identifiable information (faces, license plates, readable text) in detection frames before storage or export so that the platform complies with GDPR, CCPA, and organizational privacy policies.**

### Acceptance Criteria

- [ ] `openeye watch --redact faces` detects and blurs all human faces in captured frames before storage, API responses, or export
- [ ] `openeye watch --redact plates` detects and blurs license plates / vehicle registration numbers
- [ ] `openeye watch --redact text` detects and obscures readable text (OCR-detectable strings) in frames — useful for redacting whiteboards, screens, documents visible in camera feeds
- [ ] Multiple redaction types can be combined: `--redact faces,plates,text`
- [ ] Redaction methods are configurable: `--redact-method blur` (Gaussian blur, default), `--redact-method pixelate`, `--redact-method black` (solid black fill), `--redact-method mask` (colored overlay)
- [ ] Blur intensity is configurable: `--redact-blur-radius 25` (default: 15 pixels) — higher values for stricter privacy requirements
- [ ] Redaction is applied **before** the frame is written to any storage, sent via API, forwarded to webhooks (story 195), or exported to annotation tools (story 89)
- [ ] The unredacted original is never persisted by default. `--retain-originals --retention 24h` stores the unredacted frame in a separate encrypted store with an automatic purge after the retention window
- [ ] Access to unredacted originals requires explicit privilege: `openeye admin role grant --user analyst@corp.com --permission pii.originals.read`
- [ ] `openeye run --redact faces image.jpg --output redacted.jpg` batch-redacts a single image or directory of images
- [ ] PII detection confidence threshold: `--redact-confidence 0.7` (default: 0.5) — lower threshold = more aggressive redaction (fewer misses, more false positives)
- [ ] Redaction metadata is included in the `PredictionResult`: `metadata.redactions: [{type: "face", bbox: {...}, confidence: 0.92, method: "blur"}]` — the bbox refers to the redacted region, not the original content
- [ ] Face detection model is lightweight and runs alongside the primary detection model — total pipeline latency increase is <20ms on GPU
- [ ] `openeye admin redaction audit --last 7d` shows redaction statistics: total frames processed, redactions applied per type, average detections per frame

### Edge Cases

- [ ] Partial face detection (person turning away, occluded by object): the redaction region is expanded by `--redact-padding` (default: 10% of bbox size) to ensure partial faces are fully covered
- [ ] Face in a photo/poster within the camera view (face of a face): redacted by default. `--redact-skip-media` uses context (rectangular frame, flat surface) to skip faces that appear to be in printed/displayed media — this is best-effort and may have false negatives
- [ ] Extremely small faces (<20px): detected with lower confidence. If below `--redact-confidence`, they are not redacted — `openeye admin redaction audit` includes a `small_face_misses` counter for monitoring
- [ ] Redaction of a face that overlaps with a detection bounding box: the redacted frame is used for all downstream processing. If the primary model needs the unredacted frame for detection (e.g., person re-identification), `--detect-before-redact` runs primary detection first, then redacts for storage/output
- [ ] License plates from multiple countries: the plate detection model supports North American, European, and Asian plate formats. Unsupported formats may be missed — `openeye admin redaction supported-regions` lists supported regions
- [ ] Text redaction false positives (e.g., patterned surfaces detected as text): `--redact-text-min-chars 3` (default) requires at least 3 contiguous characters — random patterns are less likely to trigger
- [ ] Video stream with no faces/plates/text: redaction pipeline adds zero overhead when no PII is detected (early exit after detection model returns empty)
- [ ] `--retain-originals` storage fills up: `--retain-max-storage 10GB` enforces a cap. When the cap is reached, the oldest originals are purged first (FIFO). A warning is logged when storage exceeds 80% of the cap
- [ ] Redaction applied to a frame that is then exported to CVAT/Label Studio (story 89): the exported annotation references the redacted frame. A `redacted: true` flag is included in the annotation metadata
- [ ] GPU memory pressure: if running redaction model + primary model exceeds available VRAM, the redaction model falls back to CPU inference with a performance warning — does not crash
- [ ] GDPR subject access request: `openeye admin redaction sar --subject-id <tracking-id>` exports all frames where the subject was detected (pre-redaction, if `--retain-originals` is active and within retention) for DSAR compliance
- [ ] Redaction failure storing unredacted frames: if redaction model fails mid-frame, the frame must never be persisted unredacted (fail-closed) — drop the frame entirely if redaction cannot complete
- [ ] Race condition between redaction and storage: in multi-threaded pipeline, a frame could be written before redaction processes it — redaction must be a synchronous gate before any write path
- [ ] PII in detection metadata: bounding box coordinates, tracking IDs, and behavioral patterns can constitute PII under GDPR even without face images — DLP should address metadata-level PII
- [ ] Retroactive redaction of stored frames: model update improving face detection means previously stored frames may have missed faces — add `openeye admin redaction reprocess --since <date>`

### Technical Notes

- Face detection uses a lightweight model (e.g., SCRFD or RetinaFace) bundled with OpenEye — does not require a separate `--models` flag
- License plate detection uses a YOLO-based plate detector fine-tuned on multi-region plates
- Text detection uses EAST or DBNet for text region detection — does not perform OCR, only region detection for redaction
- Redaction logic lives in `cli/openeye_ai/privacy/` with `detector.py`, `redactor.py`, `original_store.py`
- Unredacted originals are stored in `~/.openeye/originals/` encrypted with AES-256-GCM using a key from the secrets rotation system (story 119)
- The `--redact` flag is orthogonal to `--models` — redaction models are always available and loaded on demand
- Dependencies: `pip install openeye-sh[privacy]` installs the redaction models and `opencv-contrib-python` for blur/pixelate operations
- References story 120 for DLP policy integration, story 124 for compliance reporting, story 125 for data residency of original frames

---

## 122. Penetration Testing Framework

**As a security engineer, I can run a built-in security scanning tool against my OpenEye deployment to validate its security posture and identify vulnerabilities before production rollout.**

### Acceptance Criteria

- [ ] `openeye security scan --target https://openeye.corp.com:8000` runs a comprehensive security scan against a running OpenEye deployment
- [ ] Scan modules include: `tls` (certificate validation, cipher suites, protocol versions), `auth` (authentication bypass attempts, token validation), `api` (injection, parameter tampering, IDOR), `headers` (security headers, CORS), `rate-limit` (rate limit validation), `network` (open ports, service enumeration), `config` (default credentials, debug endpoints)
- [ ] Individual modules are selectable: `--modules tls,auth,api` to run only specific checks
- [ ] `openeye security scan --target local` scans the local configuration files and running instance for misconfigurations without network access
- [ ] Scan results are output in multiple formats: `--format text` (default, terminal-friendly), `--format json`, `--format sarif` (for GitHub Security tab / IDE integration), `--format html` (standalone report)
- [ ] Each finding includes: severity (`critical`, `high`, `medium`, `low`, `info`), title, description, affected endpoint/config, remediation steps, CWE reference
- [ ] `openeye security scan --baseline previous-scan.json --target ...` compares against a baseline and reports only new/changed findings — useful for CI/CD regression testing
- [ ] Exit code reflects scan results: `0` = no critical/high findings, `1` = high findings, `2` = critical findings — usable in CI/CD pipelines with `openeye security scan || exit 1`
- [ ] `openeye security scan --fix` attempts auto-remediation for safe, well-understood issues (e.g., adding missing security headers, disabling debug mode). Fixes require `--confirm` or interactive approval
- [ ] TLS scan checks: certificate expiry (warns if <30 days), weak cipher suites, TLS 1.0/1.1 usage, missing HSTS, certificate chain completeness
- [ ] Auth scan checks: API key in query parameter, missing rate limit on login, brute-force protection, token expiry validation, CORS wildcard, JWT algorithm confusion (alg:none)
- [ ] Config scan checks: debug mode enabled in production, default SCIM tokens (story 116), permissive CORS origins, disabled MFA enforcement (story 117), unencrypted secrets on disk
- [ ] `openeye security scan --schedule "0 3 * * 1"` runs scans on a cron schedule with results emailed to `--notify security@corp.com`

### Edge Cases

- [ ] Scanning a deployment behind a WAF/CDN: WAF may block scan requests. `--waf-friendly` mode uses slower, less aggressive scanning patterns and respects `429` responses — logs a warning if scan coverage is reduced
- [ ] Scanning a deployment with MFA enforcement (story 117): the scanner uses a dedicated service account (story 118) with the `security.scan` scope — MFA is bypassed for scan accounts
- [ ] TLS scan against a self-signed certificate: reports the self-signed cert as `info` (not `critical`) if `--allow-self-signed` is set. Without the flag, it reports as `high` with instructions to add to the trust store
- [ ] API scan discovering an actual vulnerability (e.g., SQL injection in a custom plugin): the scan does NOT exploit the vulnerability — it only confirms exploitability with proof-of-concept payloads that are safe (e.g., `1 AND 1=1` vs `1 AND 1=2` response difference)
- [ ] Network scan on a deployment in a restricted network: if the scanner cannot reach certain ports, reports them as `inconclusive` rather than `pass` — clearly distinguishes "not vulnerable" from "not tested"
- [ ] Rate limit scan triggers the actual rate limit and gets blocked: the scanner detects the `429` response as validation that rate limiting is working and marks the check as `pass`
- [ ] Config scan finds secrets in environment variables: reports the env var name (e.g., `OPENEYE_DB_PASSWORD is set`) but NEVER logs the value. Remediation suggests using a secrets manager (story 199)
- [ ] Baseline comparison with a scan from a different version: findings are matched by CWE + endpoint, not by internal ID — version upgrades that fix a vulnerability correctly show the finding as `resolved`
- [ ] Scan timeout: individual check timeout is configurable (`--check-timeout`, default: 30s). Timed-out checks are reported as `inconclusive` with the timeout duration
- [ ] `--fix` mode and irreversible changes: auto-fix only applies to configuration file changes and runtime settings. It does NOT modify TLS certificates, database schemas, or third-party integrations. Each fix is logged to the audit trail
- [ ] Scan report injection: if findings include attacker-controlled strings (e.g., malicious `X-Powered-By` header), HTML report could execute JavaScript — sanitize all findings before HTML rendering
- [ ] Self-scan causing DoS: network and rate-limit scan modules could overwhelm target if misconfigured — add `--max-concurrent-checks` and `--scan-rate-limit` defaults
- [ ] JWT algorithm confusion test triggering IR: testing `alg:none` by submitting forged token could trigger incident response (story 123) — tag scan-originated traffic and exclude from IR triggers

### Technical Notes

- Security scanner lives in `cli/openeye_ai/security/` with `scanner.py`, `modules/tls.py`, `modules/auth.py`, `modules/api.py`, `modules/headers.py`, `modules/rate_limit.py`, `modules/network.py`, `modules/config.py`
- SARIF output follows the SARIF 2.1.0 schema for integration with GitHub Advanced Security, VS Code SARIF Viewer, and other tools
- TLS scanning uses `ssl` stdlib and `cryptography` library for certificate parsing
- API scanning uses `httpx` with crafted payloads — no dependency on external scanning tools (no Burp, ZAP, or Nikto dependency)
- CWE references mapped from the MITRE CWE database (e.g., CWE-295 for cert validation, CWE-307 for brute force, CWE-942 for CORS)
- References story 117 for MFA validation checks, story 118 for service account scan credentials, story 123 for automated incident response triggered by scan findings

---

## 123. Incident Response Automation

**As a security operations engineer, I can configure automated incident response workflows triggered by security anomalies so that threats are contained rapidly without manual intervention.**

### Acceptance Criteria

- [ ] `openeye security incident-response configure --config ir-playbook.yaml` loads an incident response playbook defining automated actions
- [ ] Trigger types: `brute_force` (N failed auth attempts in M seconds), `anomalous_access` (API access from unusual IP/geo), `privilege_escalation` (scope change attempts), `data_exfiltration` (bulk data download), `scan_detected` (port scan or vulnerability scan from external source), `config_tampering` (unauthorized config changes)
- [ ] Response actions: `block_ip` (add to firewall deny list), `disable_account` (deactivate user/service account), `revoke_sessions` (invalidate all active tokens), `alert` (notify via email/Slack/PagerDuty), `snapshot` (capture system state for forensics), `isolate_camera` (disconnect a compromised camera source), `rate_limit` (apply aggressive rate limiting to source)
- [ ] Playbook actions are composable: a single trigger can execute a sequence of actions with `and_then` chaining and `delay_before` intervals
- [ ] Severity-based escalation: `--escalation low:alert,medium:alert+rate_limit,high:alert+block_ip+revoke_sessions,critical:alert+block_ip+disable_account+snapshot`
- [ ] `openeye security incident-response status` shows active incidents, triggered playbooks, and action outcomes in real-time
- [ ] `openeye security incident-response history --last 30d` shows historical incidents with timeline, trigger details, actions taken, and resolution status
- [ ] Each incident creates a record with a unique `incident_id`, timeline of events, triggered rule, actions executed, and evidence (logs, request payloads, source IPs)
- [ ] `openeye security incident-response test --trigger brute_force --dry-run` simulates a trigger without executing actions — validates the playbook configuration
- [ ] Auto-remediation cooldown: after executing a playbook, the same trigger is suppressed for `--cooldown` (default: 5 minutes) to prevent action loops
- [ ] Manual override: `openeye security incident-response override --incident-id INC-2026-001 --action unblock_ip --reason "false positive"` reverses an automated action with an audit log entry
- [ ] Integration with SIEM (story 128): all incident events are forwarded as CEF/syslog events with `severity`, `action`, and `outcome` fields
- [ ] PagerDuty/OpsGenie integration: `--alert-channel pagerduty --pagerduty-routing-key <key>` creates PagerDuty incidents for high/critical severity triggers

### Edge Cases

- [ ] False positive `brute_force` detection (legitimate user entering wrong password): `--brute-force-threshold` is configurable (default: 10 attempts in 60 seconds). Blocked IPs are auto-unblocked after `--block-duration` (default: 1h) unless escalated
- [ ] `block_ip` on a NAT gateway IP (affecting multiple legitimate users): `--nat-aware-mode` checks if the blocked IP is in a known NAT range (`--nat-ranges 10.0.0.0/8`) and applies rate limiting instead of full block. Alert includes the NAT warning
- [ ] `disable_account` triggered on an admin account: admin accounts have an additional confirmation step. The incident escalates to `critical` and requires manual approval via the management API within `--admin-disable-timeout` (default: 15 min). If no approval, the account is disabled
- [ ] Cascading incidents: a `scan_detected` trigger firing `block_ip` causes the scanner to retry from a different IP, triggering another `scan_detected`. The `--max-actions-per-hour` limit (default: 100) prevents runaway action loops — excess triggers are logged but not acted upon
- [ ] Incident during OpenEye server restart: triggers that fire during shutdown are queued in a persistent store (`~/.openeye/ir-queue/`). On restart, queued incidents are re-evaluated — if the trigger condition no longer exists, the incident is auto-closed
- [ ] `snapshot` action when disk space is low: the snapshot is compressed and if disk usage exceeds 90%, older snapshots are pruned. If disk is critically full (<500MB), the snapshot is skipped with a warning
- [ ] Network partition during `alert` action (email/Slack/PagerDuty unreachable): alerts are queued locally and retried with exponential backoff. The blocking/remediation actions proceed independently — alerting failure does not prevent containment
- [ ] `data_exfiltration` false positive from a legitimate batch export (story 89): `--exfiltration-whitelist` accepts service account names and IP ranges that are excluded from exfiltration detection
- [ ] Concurrent incidents from the same source: incidents from the same source IP within the cooldown window are merged into a single incident with an updated timeline — does not create duplicate incidents
- [ ] Playbook YAML syntax error: validated on load with detailed error messages including line numbers. Invalid playbooks are rejected — the previous valid playbook remains active
- [ ] IR playbook as attack vector: attacker with admin access modifying `ir-playbook.yaml` to disable responses — playbook changes must require MFA re-verification and be logged with diff to SIEM
- [ ] `block_ip` on SIEM server's IP: misconfigured trigger blocks the syslog/Splunk server — add `--never-block` IP allowlist for critical infrastructure
- [ ] `disable_account` on last super-admin: no way to recover without database access — ensure at least one super-admin is exempt from automated disabling (break-glass account)
- [ ] Playbook YAML deserialization: if YAML parser supports `!!python/object`, malicious playbook executes arbitrary code — ensure `yaml.safe_load()` is used

### Technical Notes

- IR engine lives in `backend/security/incident_response/` with `engine.py`, `triggers.py`, `actions.py`, `playbooks.py`, `escalation.py`
- Trigger evaluation uses a sliding window counter backed by Redis (or in-memory with LRU for single-node deployments)
- `block_ip` action interfaces with the system firewall via `iptables`/`nftables` on Linux or security groups via cloud provider APIs (AWS/GCP/Azure)
- PagerDuty integration uses the Events API v2 (`POST https://events.pagerduty.com/v2/enqueue`)
- Incident storage in the `incidents` table: `id`, `trigger_type`, `severity`, `source_ip`, `source_account`, `actions_taken` (JSON), `status` (open/resolved/false_positive), `created_at`, `resolved_at`
- References story 122 for security scan-triggered incidents, story 128 for SIEM forwarding, story 124 for compliance reporting of incidents

### Example Config

```yaml
# ir-playbook.yaml
playbooks:
  - name: brute-force-response
    trigger:
      type: brute_force
      threshold: 10
      window: 60s
    severity: high
    actions:
      - block_ip:
          duration: 1h
      - alert:
          channels: [pagerduty, slack]
          message: "Brute force attack from {{source_ip}} — {{attempt_count}} attempts in {{window}}"
      - snapshot:
          include: [access_logs, auth_logs, network_connections]
    cooldown: 5m

  - name: data-exfiltration-response
    trigger:
      type: data_exfiltration
      threshold_mb: 500
      window: 10m
      whitelist:
        service_accounts: [ci-pipeline, backup-agent]
    severity: critical
    actions:
      - rate_limit:
          requests_per_minute: 10
      - revoke_sessions:
          scope: source_account
      - alert:
          channels: [pagerduty, email]
          escalation: immediate
      - snapshot:
          include: [all]
    cooldown: 15m

  - name: config-tampering-response
    trigger:
      type: config_tampering
      monitored_files:
        - ~/.openeye/config.yaml
        - ~/.openeye/rotation-config.yaml
        - ~/.openeye/scim-mapping.yaml
    severity: critical
    actions:
      - snapshot:
          include: [config_diff, process_list, auth_logs]
      - alert:
          channels: [pagerduty, email, slack]
      - disable_account:
          scope: source_account
          require_approval: true
          approval_timeout: 15m
```

---

## 124. Compliance Reporting Dashboard

**As an enterprise compliance officer, I can access a dashboard showing our compliance posture across SOC 2, GDPR, HIPAA, and ISO 27001 controls so that audit readiness is continuously monitored.**

### Acceptance Criteria

- [ ] `openeye admin compliance dashboard` launches a web-based compliance dashboard at `http://localhost:8000/admin/compliance` (authenticated, `admin` role required)
- [ ] Dashboard displays compliance frameworks as selectable tabs: SOC 2 Type II, GDPR, HIPAA, ISO 27001, PCI DSS — each framework maps to a set of controls
- [ ] Each control shows a status: `compliant` (green), `partially_compliant` (yellow), `non_compliant` (red), `not_applicable` (grey) — status is auto-evaluated from platform telemetry
- [ ] SOC 2 control mappings include: CC6.1 (logical access — maps to MFA enforcement, story 117), CC6.3 (role-based access — maps to SCIM, story 116), CC7.2 (monitoring — maps to SIEM, story 128), CC8.1 (change management — maps to config audit logs), CC6.6 (encryption — maps to secrets rotation, story 119)
- [ ] GDPR control mappings include: Art. 5 (data minimization — maps to DLP, story 120), Art. 17 (right to erasure — maps to PII redaction, story 121), Art. 25 (privacy by design — maps to redaction defaults), Art. 33 (breach notification — maps to incident response, story 123), Art. 44 (data transfers — maps to data residency, story 125)
- [ ] HIPAA control mappings include: 164.312(a) (access control — maps to RBAC + MFA), 164.312(e) (transmission security — maps to TLS, story 126), 164.312(c) (integrity — maps to audit logging), 164.308(a)(5) (security awareness — maps to pen testing, story 122)
- [ ] `openeye admin compliance report --framework soc2 --format pdf` generates a downloadable compliance report with evidence artifacts (log excerpts, configuration snapshots, policy documents)
- [ ] `openeye admin compliance report --framework gdpr --format csv` exports control statuses for integration with GRC tools (ServiceNow GRC, Archer, OneTrust)
- [ ] Evidence collection is automated: each control links to the relevant audit log query, configuration check, or system state that proves compliance
- [ ] Compliance trends: dashboard shows historical compliance scores (daily snapshots) with a 90-day trend graph — regressions are highlighted
- [ ] Alert on compliance regression: `--compliance-alert-on regression --notify compliance@corp.com` sends an email when any control status drops from `compliant` to `partially_compliant` or `non_compliant`
- [ ] Custom controls: `openeye admin compliance control create --framework custom --name "Vendor Risk" --description "..." --check-command "openeye security scan --modules tls"` adds organization-specific controls with custom evaluation logic
- [ ] Dashboard supports multi-tenant view: `--org-filter` shows compliance for a specific organization in multi-tenant deployments

### Edge Cases

- [ ] Control status flapping (e.g., MFA enforcement toggled on/off): the dashboard shows the current state and a `status_changed_at` timestamp. Compliance trend graph reveals the flapping pattern for auditors
- [ ] New framework controls added in a platform update: new controls default to `not_evaluated` and require initial assessment. A banner notifies the compliance team of new controls requiring attention
- [ ] Evidence artifact too large (e.g., 1GB audit log for a 90-day period): evidence links point to paginated queries rather than embedding full logs. PDF reports include only summary statistics and sample entries with instructions to access full logs
- [ ] Compliance check depends on an external system (e.g., SIEM integration, story 128) that is currently unavailable: the control shows `inconclusive` with a message about the dependency and the last known status
- [ ] Multi-framework overlap: a single platform feature (e.g., encryption at rest) satisfies controls in multiple frameworks. The dashboard shows cross-references but evaluates each framework independently
- [ ] GDPR "right to erasure" control (Art. 17): compliance requires that `--retain-originals` (story 121) has a finite retention window AND that erasure requests can be processed. The control checks both configuration and the existence of the erasure API endpoint
- [ ] Historical compliance data storage: daily snapshots are retained for 3 years (configurable via `--compliance-retention`). Storage is estimated at ~5KB per framework per day — warnings if compliance DB exceeds `--compliance-max-storage` (default: 1GB)
- [ ] Report generation timeout: PDF report generation for a complex multi-framework report may take >30 seconds. The API returns a `202 Accepted` with a job ID — the client polls `GET /admin/compliance/reports/{job_id}` for completion
- [ ] Custom control with a failing check command: the control is marked `non_compliant` with the check command's stderr output as the evidence. Exit code 0 = compliant, non-zero = non-compliant
- [ ] Compliance snapshot integrity: daily snapshots could be tampered with — add cryptographic signing so auditors can verify they have not been altered
- [ ] Multi-tenant compliance isolation: ensure tenant admin cannot access another tenant's compliance data by manipulating filter parameter or direct API calls
- [ ] Report containing sensitive operational data: PDFs include evidence artifacts (log excerpts, config snapshots) — add `--external-safe` mode that redacts operational details for external sharing

### Technical Notes

- Compliance engine lives in `backend/compliance/` with `frameworks/soc2.py`, `frameworks/gdpr.py`, `frameworks/hipaa.py`, `frameworks/iso27001.py`, `evaluator.py`, `reports.py`
- Control-to-feature mapping is defined in `backend/compliance/mappings.yaml` — each control has an `evaluator` function that queries platform state
- Dashboard frontend is a React component served at `/admin/compliance` using the existing dashboard shell
- PDF report generation uses `weasyprint` or `reportlab` — optional dependency: `pip install openeye-sh[compliance-reports]`
- Compliance snapshots are stored in the `compliance_snapshots` table: `framework`, `control_id`, `status`, `evidence_ref`, `evaluated_at`
- API endpoints: `GET /admin/compliance/frameworks`, `GET /admin/compliance/controls?framework=soc2`, `POST /admin/compliance/reports`
- References stories 116–123, 125–130 as the underlying controls being evaluated

---

## 125. Data Residency & Sovereignty

**As an enterprise admin, I can configure data processing and storage to stay within specific geographic regions so that the platform complies with data residency regulations (GDPR, LGPD, PDPA, data sovereignty laws).**

### Acceptance Criteria

- [ ] `openeye admin data-residency configure --region eu-west --storage s3://openeye-eu-west/data --processing eu-only` restricts all data for the specified tenant/project to the EU region
- [ ] Supported regions: `us-east`, `us-west`, `eu-west`, `eu-central`, `ap-southeast`, `ap-northeast`, `ca-central`, `sa-east` — mapped to cloud provider regions (AWS, GCP, Azure)
- [ ] Detection frames, model outputs, audit logs, and cached data are all stored within the configured region — no cross-region replication by default
- [ ] Processing residency: inference is executed only on compute resources within the configured region. `openeye serve --residency eu-west` validates that the server's region matches before starting
- [ ] `openeye admin data-residency status` shows per-project/tenant region configuration, current storage locations, and any residency violations detected
- [ ] Cross-region data transfer requests (e.g., exporting EU data to a US webhook endpoint) are blocked with a `451 Unavailable For Legal Reasons` response and a log entry referencing the residency policy
- [ ] Region-specific encryption keys: each region uses a separate KMS key (AWS KMS, GCP Cloud KMS, Azure Key Vault) for data-at-rest encryption — keys never leave the region
- [ ] `openeye admin data-residency migrate --from us-east --to eu-west --project warehouse` migrates existing data between regions with progress tracking, integrity verification (checksums), and rollback capability
- [ ] Data residency policies are enforced at the API gateway level: requests to endpoints serving region-restricted data are routed to region-specific backends
- [ ] Multi-region deployments: `openeye serve --regions eu-west,us-east` starts separate processing pipelines per region, each isolated in terms of data flow
- [ ] Model files and weights are NOT subject to data residency (they contain no customer data) — models can be cached globally for performance
- [ ] `openeye admin data-residency audit --last 90d` generates a report of all data movements, storage locations, and any policy violations for regulatory submissions
- [ ] Configuration is stored in `~/.openeye/residency-config.yaml` and enforced globally across all OpenEye components (CLI, API, sinks, webhooks)

### Edge Cases

- [ ] User queries data from the wrong region endpoint (e.g., EU user hitting US API): the API returns `451 Unavailable For Legal Reasons` with the correct region endpoint URL — does not silently serve data from the wrong region
- [ ] Camera feed crosses regional boundaries (e.g., camera in EU processing on US server): `openeye serve --residency eu-west` refuses to ingest camera feeds from sources tagged with a different region unless `--allow-cross-region-ingest` is explicitly set
- [ ] Data migration interrupted mid-transfer: the migration is resumable — `openeye admin data-residency migrate --resume --migration-id MIG-001` picks up from the last checkpoint. Data integrity is verified via SHA-256 checksums per batch
- [ ] Region unavailable (cloud provider outage): data remains in the original region. Processing fails gracefully with `503 Service Unavailable` — does NOT fail over to a different region (which would violate residency). `--allow-failover-regions eu-central` permits explicit failover to approved regions only
- [ ] GDPR adequacy decision changes (e.g., a country is removed from the EU adequacy list): `openeye admin data-residency notify --event adequacy-change` alerts admins. Migration must be manually triggered — the platform does not auto-migrate on legal changes
- [ ] Aggregate analytics crossing regions (e.g., global dashboard showing detection counts): `--residency-analytics aggregate-only` allows aggregated/anonymized metrics to cross regions while raw data stays local. Aggregation removes all PII and reduces data to counts/averages
- [ ] Backup and disaster recovery (story 129) respects residency: backups are stored within the same region. Cross-region backup replication requires explicit `--backup-regions` configuration
- [ ] Third-party sinks (Kafka, Snowflake — stories 193, 196) must also be in the correct region: the platform validates sink endpoint regions against the residency policy on configuration — mismatched regions are rejected
- [ ] Data deletion request (GDPR Art. 17): deletion applies to all copies within the region, including backups (story 129). `openeye admin data-residency deletion-request --subject-id <id>` creates a deletion audit trail
- [ ] Edge deployment (story 90, Jetson): edge devices process data locally. If `--residency` is set, inference results are uploaded only to region-matched cloud endpoints. Local storage on the edge device is exempt from cloud residency rules but must comply with device-level encryption
- [ ] X-Data-Region header spoofing: region enforcement middleware checks `X-Data-Region` — an attacker could forge this header. Ensure header is set by API gateway (trusted) and stripped from external client requests
- [ ] Metadata leakage across regions: even if raw data stays in EU, metadata flowing to global dashboard could contain personally identifying patterns — assess whether metadata qualifies as personal data under GDPR
- [ ] CDN/cache layer violating residency: CDN caching API responses could serve EU data from US edge nodes — add `Cache-Control: no-store` for region-restricted endpoints

### Technical Notes

- Data residency logic lives in `backend/residency/` with `policy.py`, `enforcement.py`, `migration.py`, `audit.py`
- Region enforcement is implemented as middleware that checks `request.headers["X-Data-Region"]` against the project's residency config
- Storage abstraction layer (`backend/storage/`) routes reads/writes to region-specific storage backends (S3 bucket per region, GCS bucket per region, etc.)
- KMS key references are stored per region: `residency_keys` table with `region`, `kms_key_arn`, `provider`, `created_at`
- Migration uses a chunked transfer pattern: read chunk from source → encrypt with destination region key → write to destination → verify checksum → delete from source (only after full verification)
- Configuration API: `GET/PUT /admin/data-residency/config`, `POST /admin/data-residency/migrate`, `GET /admin/data-residency/audit`
- References story 119 for region-specific key rotation, story 120 for DLP policy interaction, story 124 for compliance reporting, story 129 for backup residency

### Example Config

```yaml
# ~/.openeye/residency-config.yaml
residency:
  default_region: us-east

  projects:
    warehouse-eu:
      region: eu-west
      storage:
        provider: s3
        bucket: openeye-eu-west-warehouse
        endpoint: s3.eu-west-1.amazonaws.com
      kms:
        provider: aws
        key_arn: arn:aws:kms:eu-west-1:123456:key/eu-key-id
      allowed_failover_regions: [eu-central]
      cross_region_analytics: aggregate-only

    factory-apac:
      region: ap-southeast
      storage:
        provider: gcs
        bucket: openeye-apac-factory
      kms:
        provider: gcp
        key_name: projects/my-project/locations/asia-southeast1/keyRings/openeye/cryptoKeys/factory-key
      allowed_failover_regions: []
```

---

## 126. Certificate Management

**As an enterprise admin, I can manage TLS certificates for OpenEye endpoints with auto-renewal via ACME/Let's Encrypt or internal PKI so that encrypted communications are maintained without manual certificate rotation.**

### Acceptance Criteria

- [ ] `openeye serve --tls auto --domain openeye.corp.com` automatically obtains and configures a TLS certificate from Let's Encrypt using the ACME protocol
- [ ] `openeye serve --tls acme --acme-server https://acme.internal.corp.com/directory --domain openeye.corp.com` supports internal ACME servers (e.g., step-ca, Vault PKI)
- [ ] `openeye serve --tls manual --tls-cert /path/to/cert.pem --tls-key /path/to/key.pem` uses manually provided certificates with expiry monitoring
- [ ] `openeye serve --tls mutual --tls-cert ... --tls-key ... --tls-ca /path/to/ca.pem` enables mutual TLS (mTLS) requiring client certificates
- [ ] ACME challenge types: `--acme-challenge http-01` (default, requires port 80), `--acme-challenge dns-01 --dns-provider cloudflare --dns-api-token <token>` (supports Cloudflare, Route53, Google Cloud DNS)
- [ ] Auto-renewal: certificates are renewed 30 days before expiry. Renewal happens in the background — the server continues serving with the current cert during renewal
- [ ] `openeye admin certs status` shows all managed certificates with: domain, issuer, expiry date, days remaining, auto-renewal status, last renewal attempt
- [ ] `openeye admin certs renew --domain openeye.corp.com` forces an immediate renewal attempt
- [ ] Certificate chain validation: on startup, validates that the full certificate chain is complete and trusted. Warns if intermediate certificates are missing
- [ ] SAN (Subject Alternative Name) support: `--domain openeye.corp.com,api.openeye.corp.com,*.openeye.corp.com` obtains a single certificate covering multiple domains
- [ ] OCSP stapling is enabled by default for improved client-side certificate validation performance
- [ ] Certificate events are logged to the audit trail: `cert.obtained`, `cert.renewed`, `cert.expiring_soon` (30 days), `cert.expired`, `cert.renewal_failed`
- [ ] `openeye admin certs export --domain openeye.corp.com --format pkcs12 --output cert.p12` exports certificates in various formats for use by other services

### Edge Cases

- [ ] ACME rate limit exceeded (Let's Encrypt: 50 certs/domain/week): the renewal is retried after the rate limit window. If in staging/testing, suggests using `--acme-server https://acme-staging-v02.api.letsencrypt.org/directory`
- [ ] DNS-01 challenge with a slow DNS propagation: `--dns-propagation-timeout` (default: 120s) waits for DNS TXT record propagation. If propagation times out, retries once after an additional 60 seconds before failing
- [ ] Certificate renewal fails (ACME server down, DNS provider error): the existing certificate continues to be used. Warnings escalate as expiry approaches: `info` at 30 days, `warn` at 14 days, `critical` at 7 days, `alert` (PagerDuty/email) at 3 days
- [ ] Manual certificate expiry: `--tls manual` mode monitors the cert's `notAfter` date and sends warnings on the same escalation schedule. No auto-renewal is attempted
- [ ] mTLS with expired client certificate: the TLS handshake fails with `SSL_ERROR_CERTIFICATE_EXPIRED`. The server logs the client's certificate serial number and issuer for debugging
- [ ] Certificate and key file permissions: on startup, warns if the key file is readable by others (`chmod` is not `600` or stricter). `--strict-permissions` makes this a fatal error
- [ ] Hot-reload of renewed certificate: the server reloads the new certificate without restart using `ssl.SSLContext.load_cert_chain()` — active connections continue using the old cert, new connections use the new cert
- [ ] Wildcard certificate with DNS-01: wildcard domains (`*.openeye.corp.com`) require DNS-01 challenge type. If `--acme-challenge http-01` is specified with a wildcard domain, exits with a clear error
- [ ] Multiple server instances behind a load balancer: each instance independently manages its certificate, or a shared storage path (`--cert-storage s3://certs/`) synchronizes certificates across instances
- [ ] ACME account key management: the ACME account private key is stored at `~/.openeye/acme/account-key.pem` and encrypted at rest. Loss of this key requires re-registration with the ACME server
- [ ] Internal CA certificate rotation: when `--tls-ca` points to a CA cert that is being rotated (story 119), the server detects the updated CA file via filesystem watch and reloads the trust store without restart
- [ ] Private key exposure via backup: certificate private keys may be included in backups (story 129) — ensure keys are excluded or encrypted separately
- [ ] Certificate transparency (CT) log exposure: Let's Encrypt publishes to CT logs, making internal domain names publicly visible — warn when using public ACME for internal domains
- [ ] Race condition during hot-reload: if cert file is partially written when filesystem watcher triggers, `load_cert_chain()` may fail — use atomic file replacement and validate before loading

### Technical Notes

- ACME client implementation uses the `acme` library (from certbot) or `acme-tiny` for lightweight deployments
- Certificate storage: ACME-obtained certs at `~/.openeye/certs/<domain>/` with `cert.pem`, `key.pem`, `chain.pem`, `fullchain.pem`
- DNS-01 providers are pluggable: `cli/openeye_ai/certs/dns_providers/` with `cloudflare.py`, `route53.py`, `gcloud_dns.py`
- TLS configuration in the FastAPI/Uvicorn server uses `ssl.SSLContext` with configurable cipher suites and min protocol version (`--tls-min-version TLSv1.2`, default: TLSv1.2)
- OCSP stapling is configured via the `ssl` module's `SSLContext.set_ocsp_client_callback()`
- Certificate management logic lives in `backend/certs/` with `acme_client.py`, `monitor.py`, `store.py`
- Dependencies: `pip install openeye-sh[tls]` installs `acme`, `cryptography`, `josepy`
- References story 119 for key rotation of the certificate private key, story 122 for TLS security scanning, story 127 for API gateway TLS termination

---

## 127. API Gateway Integration

**As an enterprise admin, I can deploy OpenEye behind Kong, AWS API Gateway, or Istio service mesh so that the platform inherits enterprise-grade traffic management, authentication, and observability.**

### Acceptance Criteria

- [ ] `openeye serve --gateway kong --kong-admin http://kong-admin:8001` auto-registers OpenEye as an upstream service in Kong with routes, plugins, and health checks
- [ ] `openeye serve --gateway aws-apigw --apigw-id abc123 --apigw-stage prod` configures integration with an existing AWS API Gateway (REST or HTTP API)
- [ ] `openeye serve --gateway istio` configures Istio VirtualService and DestinationRule resources for service mesh integration (expects `kubectl` context)
- [ ] Kong integration auto-configures plugins: `rate-limiting`, `key-auth` or `jwt`, `cors`, `request-size-limiting`, `prometheus` — each plugin's settings are configurable via `--kong-plugin-config plugins.yaml`
- [ ] AWS API Gateway integration creates: API resources matching OpenEye's routes, Lambda authorizer or Cognito authorizer for auth, usage plans with throttling, and CloudWatch logging
- [ ] Istio integration creates: `VirtualService` with route matching, `DestinationRule` with circuit breaker settings, `AuthorizationPolicy` for mTLS enforcement, `PeerAuthentication` for strict mTLS
- [ ] Health check endpoint (`/health`) is registered with the gateway for active health monitoring — unhealthy instances are removed from the upstream pool
- [ ] `openeye admin gateway status` shows the gateway configuration, registered routes, active health check status, and traffic metrics (if available from the gateway)
- [ ] Gateway-agnostic mode: `openeye serve --gateway-headers` reads standard gateway headers (`X-Request-ID`, `X-Forwarded-For`, `X-Real-IP`, `X-Forwarded-Proto`) and includes them in logs and audit trail
- [ ] OpenEye trusts the gateway for TLS termination: `--tls-termination gateway` disables TLS on the OpenEye server (listens HTTP) and trusts `X-Forwarded-Proto: https` from the gateway
- [ ] Circuit breaker configuration: `--circuit-breaker-threshold 5 --circuit-breaker-timeout 30s` — after 5 consecutive failures, the upstream is marked unhealthy for 30 seconds
- [ ] `openeye serve --gateway-export kong > kong-config.yaml` exports the gateway configuration as a declarative config file (Kong decK format, Istio YAML, or AWS CloudFormation/Terraform) for GitOps workflows

### Edge Cases

- [ ] Kong admin API unreachable on startup: retries with exponential backoff (1s → 30s, max 10 attempts). After exhausting retries, starts without gateway registration and logs a warning — the server is functional but not routed through Kong
- [ ] AWS API Gateway deployment fails (CloudFormation error, IAM permission issue): the error message includes the specific AWS error code and required IAM permissions (e.g., `apigateway:CreateRestApi`, `lambda:CreateFunction`)
- [ ] Istio sidecar not injected (pod not in an Istio-enabled namespace): `--gateway istio` detects the missing sidecar by checking for the `istio-proxy` container and logs a warning with instructions to enable injection (`kubectl label namespace <ns> istio-injection=enabled`)
- [ ] Kong upstream already exists with the same name: `--kong-upsert` mode updates the existing upstream/routes/plugins. `--kong-strict` mode fails with a conflict error. Default: `--kong-upsert`
- [ ] API Gateway timeout for long inference requests: gateway timeout is configured to `--gateway-timeout` (default: 60s). If inference exceeds the timeout, the gateway returns `504 Gateway Timeout`. OpenEye logs a warning about the timed-out request
- [ ] Gateway health check marks OpenEye as unhealthy during model loading: the `/health` endpoint returns `{"status": "loading", "progress": 0.45}` with HTTP 503 during model initialization. The gateway removes the instance from rotation until `/health` returns 200
- [ ] Multiple OpenEye instances behind the gateway: each instance registers with a unique `instance_id` in the upstream pool. Sticky sessions are configurable via `--gateway-sticky-sessions` (using cookie or header-based affinity) for WebSocket streaming
- [ ] Istio circuit breaker trips on a transient error spike: the DestinationRule's `outlierDetection` is configured with `consecutiveErrors: 5`, `interval: 10s`, `baseEjectionTime: 30s` — configurable via `--istio-outlier-*` flags
- [ ] Gateway injects request ID but OpenEye also generates one: OpenEye respects the incoming `X-Request-ID` header if present, otherwise generates its own. Response always echoes the `X-Request-ID` for tracing
- [ ] AWS API Gateway WebSocket API for streaming: `--apigw-type websocket` creates a WebSocket API with `$connect`, `$disconnect`, and `$default` routes. Lambda integration is not used — the API Gateway proxies directly to the OpenEye WebSocket endpoint
- [ ] Gateway header spoofing: `--tls-termination gateway` trusts `X-Forwarded-For` from any source — if accidentally exposed directly, attacker spoofs headers. Add `--trusted-proxies <CIDR>` to restrict trusted IPs
- [ ] Gateway-exported config contains secrets: `openeye serve --gateway-export kong` may include API keys — ensure exports redact secrets
- [ ] Graceful deregistration on shutdown: when OpenEye shuts down, it should deregister from gateway upstream pool — if it crashes without deregistering, gateway sends traffic to dead instance

### Technical Notes

- Gateway integration logic lives in `backend/gateway/` with `kong.py`, `aws_apigw.py`, `istio.py`
- Kong integration uses the Kong Admin API (REST) or the decK declarative format for export
- AWS API Gateway uses `boto3` for API creation and configuration
- Istio integration generates Kubernetes YAML manifests and applies them via `kubectl apply` or the Kubernetes Python client (`kubernetes` library)
- The `--gateway-export` feature generates declarative configs compatible with GitOps tools (Flux, ArgoCD for Istio; decK for Kong; Terraform/CDK for AWS)
- Dependencies: `pip install openeye-sh[kong]` installs `httpx` (already present); `pip install openeye-sh[aws-gateway]` installs `boto3`; `pip install openeye-sh[istio]` installs `kubernetes`
- References story 126 for TLS termination at the gateway, story 128 for SIEM integration via gateway access logs, story 118 for service account auth at the gateway level

---

## 128. SIEM Integration

**As a security operations engineer, I can forward OpenEye security events to Splunk, Microsoft Sentinel, or any SIEM platform via CEF, LEEF, or syslog so that OpenEye events are correlated with the rest of the enterprise security telemetry.**

### Acceptance Criteria

- [ ] `openeye serve --siem syslog --syslog-host siem.corp.com --syslog-port 514 --syslog-protocol udp` forwards security events as syslog messages (RFC 5424)
- [ ] `openeye serve --siem cef --syslog-host siem.corp.com --syslog-port 514` sends events in Common Event Format (CEF) — compatible with ArcSight, QRadar, Splunk
- [ ] `openeye serve --siem leef --syslog-host siem.corp.com --syslog-port 514` sends events in Log Event Extended Format (LEEF) — compatible with QRadar
- [ ] `openeye serve --siem splunk-hec --splunk-url https://splunk.corp.com:8088 --splunk-token <token>` sends events directly to Splunk HTTP Event Collector (HEC)
- [ ] `openeye serve --siem sentinel --sentinel-workspace-id <id> --sentinel-shared-key <key>` sends events to Microsoft Sentinel via the Log Analytics Data Collector API
- [ ] Event categories forwarded: `authentication` (login, logout, MFA, failed auth), `authorization` (permission denied, scope violation), `configuration` (config changes, secret rotation), `incident` (IR playbook triggers, story 123), `data_access` (DLP-classified data access, story 120), `system` (startup, shutdown, health changes)
- [ ] Each event includes: `timestamp` (ISO 8601), `severity` (0-10 CEF scale or syslog severity), `source` (OpenEye instance ID), `event_type`, `actor` (user/service account), `action`, `outcome` (success/failure), `target` (affected resource), `source_ip`, `details` (JSON)
- [ ] CEF format follows `CEF:0|OpenEye|OpenEye Platform|<version>|<event_id>|<name>|<severity>|<extensions>` spec
- [ ] Event filtering: `--siem-filter "severity>=high OR category=authentication"` reduces event volume by forwarding only matching events
- [ ] Buffering: events are buffered in memory (configurable: `--siem-buffer-size 10000`, default: 1000) and flushed in batches for throughput — individual syslog messages for UDP, batch POST for HEC/Sentinel
- [ ] `openeye admin siem test` sends a test event to the configured SIEM and validates connectivity
- [ ] TLS for syslog: `--syslog-protocol tcp+tls --syslog-ca /path/to/ca.pem` enables encrypted syslog transport (RFC 5425)
- [ ] Event enrichment: each event includes `openeye.instance_id`, `openeye.version`, `openeye.deployment_region` (story 125) for SIEM correlation

### Edge Cases

- [ ] Syslog server unreachable: events are buffered up to `--siem-buffer-size`. When the buffer is full, oldest events are dropped with a local log warning including the drop count. When connectivity is restored, buffered events are flushed in order
- [ ] Splunk HEC returns `503 Service Unavailable` (indexer busy): retries with exponential backoff (1s → 30s). After 5 consecutive failures, falls back to local file logging at `~/.openeye/siem-fallback.log` and retries every 60 seconds
- [ ] Sentinel Data Collector API rate limit (30MB/min per workspace): events are batched to stay within limits. If the batch exceeds the limit, it is split. A warning is logged if sustained event volume exceeds the rate limit
- [ ] UDP syslog message exceeds max size (typically 2048 bytes): long messages are truncated with a `[truncated]` suffix and the full event is available via the OpenEye audit API. `--syslog-protocol tcp` avoids this limitation
- [ ] CEF special character escaping: pipe (`|`), backslash (`\`), and equals (`=`) in event fields are escaped per the CEF spec (`\|`, `\\`, `\=`). Newlines in event descriptions are replaced with `\n` literal
- [ ] Time zone handling: all timestamps use UTC regardless of server locale. CEF `rt` (receipt time) field uses epoch milliseconds per the spec
- [ ] High event volume during an incident (story 123): a brute-force attack may generate thousands of auth failure events per minute. `--siem-rate-limit 500/s` caps the forwarding rate — excess events are aggregated into a summary event ("X auth failures suppressed")
- [ ] Dual SIEM forwarding: `--siem splunk-hec,syslog` forwards events to multiple SIEMs simultaneously. Failure in one does not block the other
- [ ] SIEM token rotation: if the Splunk HEC token or Sentinel shared key is rotated (story 119), the SIEM connector hot-reloads the new credential without restart
- [ ] Log injection attack: if an attacker includes CEF/syslog control characters in API request parameters (attempting to inject fake SIEM events), all user-supplied data is sanitized before inclusion in SIEM messages
- [ ] SIEM fallback file grows unbounded: when Splunk HEC fails, `~/.openeye/siem-fallback.log` has no size cap — add `--siem-fallback-max-size 1GB` with rotation
- [ ] Sensitive data in SIEM events: `details` JSON could contain request payloads, API keys, or PII — add `--siem-redact-fields` to scrub sensitive data before forwarding
- [ ] TLS syslog certificate expiry: long-running processes may outlive TLS certificates — TLS handshake fails silently if SIEM server's cert expires

### Technical Notes

- SIEM integration lives in `backend/siem/` with `syslog.py`, `cef.py`, `leef.py`, `splunk_hec.py`, `sentinel.py`
- Syslog implementation uses Python's `logging.handlers.SysLogHandler` for UDP and a custom TLS-enabled TCP handler for encrypted transport
- CEF mapping is defined in `backend/siem/cef_mapping.yaml` — maps internal event types to CEF event IDs and severity levels
- Splunk HEC uses `httpx` with batch POST (`/services/collector/event` with multiple events per request)
- Sentinel uses the `azure-monitor-ingestion` library or direct REST API calls to the Data Collector API
- All SIEM connectors implement a `SIEMSink` interface: `send_event(event)`, `flush()`, `close()` — similar to `EventSink` (story 193) but with SIEM-specific formatting
- Dependencies: `pip install openeye-sh[siem]` installs base syslog support (stdlib); `pip install openeye-sh[splunk]` installs `httpx`; `pip install openeye-sh[sentinel]` installs `azure-monitor-ingestion`
- References story 123 for incident response events, story 124 for compliance audit events, story 120 for DLP access events

---

## 129. Backup & Disaster Recovery

**As an enterprise admin, I can configure automated backups of OpenEye state, models, configuration, and detection data with point-in-time recovery so that the platform can be restored after data loss or infrastructure failure.**

### Acceptance Criteria

- [ ] `openeye admin backup configure --schedule "0 2 * * *" --destination s3://openeye-backups/` enables daily automated backups to S3 (also supports GCS, Azure Blob, local filesystem)
- [ ] Backup includes: configuration files (`~/.openeye/`), database state (users, service accounts, SCIM mappings, DLP policies, compliance snapshots), model weights and TensorRT engines, detection data (configurable: `--include-detections` for last N days), and audit logs
- [ ] `openeye admin backup now --destination s3://openeye-backups/ --label "pre-upgrade"` triggers an immediate manual backup with a human-readable label
- [ ] Incremental backups: after the first full backup, subsequent backups only include changed files and database deltas — reduces backup time and storage by ~80%
- [ ] Point-in-time recovery: `openeye admin restore --from s3://openeye-backups/ --point-in-time "2026-03-14T15:30:00Z"` restores the platform to its exact state at the specified timestamp using the nearest full backup + incremental deltas
- [ ] `openeye admin backup list --destination s3://openeye-backups/` shows all available backups with: label, timestamp, size, type (full/incremental), integrity status
- [ ] `openeye admin restore --from s3://openeye-backups/ --backup-id BKP-2026-0314-0200 --dry-run` simulates a restore without applying changes — shows what would be restored and any conflicts
- [ ] Backup encryption: all backups are encrypted at rest using AES-256-GCM. The encryption key is derived from `--backup-key` or fetched from the secrets manager (story 199). `--backup-key-id` references a specific key version for rotation compatibility
- [ ] Backup integrity: each backup includes SHA-256 checksums for every file. `openeye admin backup verify --backup-id BKP-2026-0314-0200` validates integrity without performing a restore
- [ ] Retention policy: `--retention-days 90 --retention-keep-monthly 12 --retention-keep-yearly 3` — daily backups older than 90 days are pruned, but the last backup of each month is kept for 12 months, and yearly backups for 3 years
- [ ] Backup notifications: `--notify backup@corp.com` sends email reports for successful/failed backups with size, duration, and any warnings
- [ ] Restore validation: after a restore, `openeye admin restore validate` runs a health check suite confirming database integrity, model loading, API functionality, and configuration consistency
- [ ] Cross-region backup: `--backup-regions us-east,eu-west` replicates backups to multiple regions for disaster recovery — respects data residency (story 125) by only replicating non-restricted data or replicating to approved regions

### Edge Cases

- [ ] Backup during active inference: database backup uses a consistent snapshot (PostgreSQL `pg_dump` with `--snapshot`). File system backup uses atomic copy — no torn reads. Active inference continues uninterrupted
- [ ] Backup destination unreachable (S3 bucket permissions, network issue): the backup job retries 3 times with exponential backoff. On failure, logs a `backup.failed` audit event and sends a notification. The next scheduled backup attempts a full backup instead of incremental
- [ ] Incremental backup chain is broken (a prior incremental is missing or corrupted): detected via chain validation before backup. Forces a new full backup and logs a warning. Does not attempt to apply incomplete incremental chains during restore
- [ ] Restore to a different version of OpenEye: the restore process checks the backup's OpenEye version against the running version. Compatible restores proceed with a warning. Incompatible versions (major version mismatch) require `--force-restore` with a prominent warning about potential schema migration issues
- [ ] Restore overwrites current state: before restoring, `openeye admin restore` automatically creates a safety backup of the current state at `~/.openeye/pre-restore-backup/`. The user can abort within `--restore-confirm-timeout` (default: 30s interactive prompt)
- [ ] Large backup (>100GB of detection data): uses multi-part upload for S3/GCS with configurable part size (`--multipart-chunk-size`, default: 100MB). Progress is reported with ETA. `Ctrl+C` during upload leaves the incomplete multipart upload — `openeye admin backup cleanup` removes incomplete uploads
- [ ] Backup key lost: without the encryption key, backups are unrecoverable. `openeye admin backup configure` warns about key management and suggests storing the key in a separate secrets manager. Key rotation uses envelope encryption — old backups remain decryptable with old key versions
- [ ] Point-in-time recovery to a moment during a secrets rotation (story 119): the restored state uses the secrets that were active at the specified point in time. If those secrets have since been rotated, the restore includes the old secrets and logs a warning to re-rotate
- [ ] Concurrent backup jobs (manual + scheduled overlap): the second job detects the lock file (`~/.openeye/backup.lock`) and waits. If the lock is stale (process crashed), `--break-lock` allows forcing the backup
- [ ] Database schema migration during restore: if the backup is from an older schema version, `openeye admin restore` automatically runs pending migrations after restoring the data. Migration failures are rolled back to the pre-restore state
- [ ] Backup manifest tampering: if attacker modifies manifest and updates hashes, integrity check passes — sign manifest with key stored separately from backup destination
- [ ] Restore from malicious backup: attacker plants modified backup (e.g., added admin user) — add backup provenance verification (sign at creation, verify before restore)
- [ ] Fernet encryption vs AES-256-GCM inconsistency: technical notes mention `cryptography.fernet` (AES-128-CBC) but acceptance criteria state AES-256-GCM — resolve this specification conflict
- [ ] Backup of in-memory state: Redis sliding window counters, session data may not be included — document what is NOT backed up

### Technical Notes

- Backup engine lives in `backend/backup/` with `engine.py`, `incremental.py`, `encryption.py`, `storage/s3.py`, `storage/gcs.py`, `storage/azure.py`, `storage/local.py`
- Database backup uses `pg_dump` for PostgreSQL with `--format=custom` for compression and selective restore
- Incremental backup tracking uses a manifest file (`backup-manifest.json`) in the backup destination that records file hashes and timestamps
- Backup storage implements a `BackupStorage` interface: `upload(path, data)`, `download(path)`, `list(prefix)`, `delete(path)`
- Encryption uses `cryptography.fernet` with a key derived via PBKDF2 from the backup key — the key derivation salt is stored in the backup metadata (not encrypted)
- Scheduler uses the same APScheduler instance as secrets rotation (story 119)
- Configuration API: `GET/POST /admin/backup/config`, `POST /admin/backup/now`, `GET /admin/backup/list`, `POST /admin/backup/restore`, `POST /admin/backup/verify`
- References story 119 for secrets in backup state, story 125 for data residency constraints on backup locations, story 124 for backup compliance reporting

---

## 130. Software Bill of Materials (SBOM)

**As an enterprise security engineer, I can obtain SBOM artifacts for every OpenEye release in SPDX and CycloneDX formats so that I can audit the software supply chain, track vulnerabilities, and comply with executive orders and procurement requirements (e.g., EO 14028).**

### Acceptance Criteria

- [ ] Every OpenEye release (GitHub release, PyPI publish, Docker image push) includes SBOM artifacts in both SPDX 2.3 (JSON) and CycloneDX 1.5 (JSON) formats
- [ ] `openeye sbom generate --format spdx` generates an SPDX SBOM for the currently installed OpenEye package and all its dependencies (direct and transitive)
- [ ] `openeye sbom generate --format cyclonedx` generates a CycloneDX SBOM with identical dependency information
- [ ] SBOM includes: package name, version, PURL (Package URL), license (SPDX license identifier), supplier, SHA-256 hash, and dependency relationships
- [ ] Docker image SBOMs are attached as attestations using `cosign attach sbom` and are retrievable via `cosign download sbom ghcr.io/openeye-sh/openeye:latest`
- [ ] PyPI release includes SBOM as a supplementary file in the GitHub release assets: `openeye-sh-<version>.spdx.json` and `openeye-sh-<version>.cdx.json`
- [ ] `openeye sbom audit` scans the generated SBOM against the OSV (Open Source Vulnerabilities) database and reports known CVEs affecting any dependency
- [ ] `openeye sbom audit --fail-on high` exits with code 1 if any dependency has a `high` or `critical` CVE — usable as a CI/CD gate
- [ ] SBOM includes system-level dependencies for Docker images: OS packages (apt/apk), CUDA runtime, cuDNN, TensorRT versions
- [ ] `openeye sbom diff --old v1.2.0 --new v1.3.0` shows dependency changes between versions: added, removed, and version-changed packages with their CVE impact
- [ ] SBOM generation includes the OpenEye model files as components with their SHA-256 hashes, versions, and licenses (where applicable)
- [ ] `openeye sbom export --format vex` generates a VEX (Vulnerability Exploitability eXchange) document for known CVEs, indicating whether they are exploitable in the OpenEye context (e.g., a vulnerability in `pillow`'s TIFF parser may be "not affected" if TIFF input is never used)
- [ ] SBOMs are signed with the release signing key: `openeye sbom verify --sbom openeye-sh-1.3.0.spdx.json --key release-key.pub` validates the SBOM signature

### Edge Cases

- [ ] Dependency with no SPDX license identifier (custom or unknown license): the SBOM uses `NOASSERTION` for the license field and flags it in `openeye sbom audit` as requiring manual review
- [ ] Transitive dependency conflict (two packages depend on different versions of the same library, pip resolves to one): the SBOM reflects the actually-installed version, not all possible versions. The `--show-conflicts` flag lists resolution decisions
- [ ] Private/internal dependency (e.g., proprietary model package not on PyPI): included in the SBOM with `supplier: OpenEye Inc.` and `downloadLocation: NOASSERTION`. License is specified as the internal license identifier
- [ ] SBOM for optional dependency groups: `openeye sbom generate --extras ros2,jetson` includes dependencies from the specified extras. Without `--extras`, only core dependencies are included
- [ ] CVE in a dependency that is only used in an optional feature (e.g., `grpcio` vulnerability but gRPC is not enabled): `openeye sbom audit` reports the CVE but `openeye sbom export --format vex` marks it as `not_affected` with justification `vulnerable_code_not_in_execute_path` if the feature is not configured
- [ ] SBOM generation on an air-gapped system (no internet for OSV lookup): `openeye sbom generate` works offline (uses local package metadata). `openeye sbom audit` requires internet — fails gracefully with a suggestion to use `--osv-db /path/to/local/osv-dump.json` for offline auditing
- [ ] Docker multi-stage build: the SBOM reflects only the final image's contents, not build-stage dependencies. Build tools (gcc, make) that are not in the final image are excluded
- [ ] Python version dependency (e.g., `dataclasses` is a dependency on Python 3.6 but built-in on 3.7+): the SBOM reflects the actual installed packages for the runtime Python version, not the union of all conditional dependencies
- [ ] SBOM for edge deployments (story 90, Jetson): `openeye sbom generate --platform linux/arm64` includes ARM-specific dependencies (TensorRT, JetPack components) and excludes x86-only packages
- [ ] Rapid successive releases: CI/CD generates SBOMs atomically per release. If two releases are built simultaneously, each gets an independent SBOM — no cross-contamination of dependency lists
- [ ] SBOM signature key rotation: when the release signing key is rotated, old SBOMs remain verifiable with the old public key. The `openeye sbom verify` command accepts `--keyring /path/to/keyring/` containing multiple public keys
- [ ] SBOM completeness for C/C++ dependencies: CUDA, cuDNN, TensorRT are native libraries that may not be detected by Python-level tools — validate SBOM against `ldd` output for shared library completeness
- [ ] SBOM tampering via CI/CD compromise: if pipeline is compromised, both SBOM and signature could be forged — consider Sigstore transparency log (Rekor) for non-repudiable signing
- [ ] VEX document staleness: VEX stating CVE is "not_affected" may become incorrect after config change — add mechanism to re-evaluate VEX when features are toggled

### Technical Notes

- SBOM generation uses `syft` (from Anchore) for comprehensive dependency detection across Python packages, OS packages, and container layers
- CycloneDX generation uses the `cyclonedx-python-lib` or `cyclonedx-bom` CLI tool
- SPDX generation uses `spdx-tools` Python library
- CVE auditing uses the OSV API (`https://api.osv.dev/v1/query`) with batched queries for efficiency
- VEX generation uses the OpenVEX specification format (JSON-LD)
- SBOM logic lives in `cli/openeye_ai/sbom/` with `generator.py`, `auditor.py`, `vex.py`, `signer.py`
- CI/CD integration: GitHub Actions workflow in `.github/workflows/release.yml` generates SBOMs post-build, signs them with `cosign`, and attaches to the release
- Docker SBOM attestation uses Sigstore/cosign: `cosign attest --predicate sbom.spdx.json --type spdxjson ghcr.io/openeye-sh/openeye:$TAG`
- PURL format for Python packages: `pkg:pypi/package-name@version`
- PURL format for Docker: `pkg:docker/openeye-sh/openeye@sha256:digest`
- Dependencies: `pip install openeye-sh[sbom]` installs `cyclonedx-bom`, `spdx-tools`; `syft` is used in CI only (Go binary, not a Python dependency)
- References story 122 for security scanning that uses the SBOM for vulnerability context, story 124 for compliance reporting of SBOM coverage
