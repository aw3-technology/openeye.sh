# Enterprise Security Core (101–115)

---

## 101. API Key Management

**As an enterprise developer, I can create, rotate, and revoke API keys with scopes and expiry so that I can securely authenticate to `openeye serve`.**

### Acceptance Criteria

- [ ] `openeye apikey create --name "production-ingest" --scopes predict,stream --expires 90d` generates a new API key with the specified scopes and TTL
- [ ] API keys are prefixed with `oek_` followed by 48 random hex characters (e.g., `oek_a1b2c3...`) for easy identification in logs and secret scanners
- [ ] Created keys are stored in the server-side key store at `~/.openeye/keys.db` (SQLite with WAL mode) with bcrypt-hashed values — the plaintext key is shown exactly once at creation time
- [ ] `openeye apikey list` displays all keys with: name, prefix (first 8 chars), scopes, created date, expires date, last used date, status (active/revoked/expired)
- [ ] `openeye apikey rotate --name "production-ingest" --grace-period 24h` creates a new key and marks the old key as deprecated — both keys work during the grace period, then the old key is auto-revoked
- [ ] `openeye apikey revoke --name "production-ingest"` immediately invalidates a key; subsequent requests using it return `401 Unauthorized` with `{"error": "api_key_revoked"}`
- [ ] Scopes are granular: `predict` (POST /predict), `stream` (GET /stream, WebSocket), `admin` (server config, model management), `models` (GET /models, POST /models/pull), `audit` (GET /audit), `keys` (API key management)
- [ ] `openeye serve --require-api-key` enforces API key authentication on all endpoints except `GET /health` and `GET /docs`
- [ ] API keys are accepted via `Authorization: Bearer oek_...` header or `X-API-Key: oek_...` header — never via query parameter (prevents key leakage in server logs and browser history)
- [ ] Each API request logs the key name (not the key value) in the access log for traceability (see story 106 for audit logging)
- [ ] `openeye apikey create --service-account --no-expiry` creates a non-expiring machine-to-machine key with a mandatory `--scopes` restriction
- [ ] Key metadata is exposed via the management API: `GET /api/v1/keys` (requires `keys` scope) returns the same data as `openeye apikey list`
- [ ] Environment variable override: `OPENEYE_API_KEY` can be set on the client side to avoid passing `--api-key` on every CLI call

### Edge Cases

- [ ] Creating a key with an already-used name returns an error: `"API key with name 'production-ingest' already exists. Use --force to replace or choose a different name"`
- [ ] Attempting to use an expired key returns `401` with `{"error": "api_key_expired", "expired_at": "2026-03-01T00:00:00Z"}` — includes the expiration timestamp so the caller can distinguish expired from revoked
- [ ] Attempting to call an endpoint outside a key's scopes returns `403 Forbidden` with `{"error": "insufficient_scope", "required": "admin", "granted": ["predict", "stream"]}`
- [ ] If `keys.db` is corrupted or unreadable on server startup, the server refuses to start with a clear error and a recovery suggestion (`openeye apikey repair`)
- [ ] Concurrent key rotations for the same key name are serialized — the second rotation waits for the first grace period to be established
- [ ] Key names are restricted to alphanumeric, hyphens, and underscores (1–64 chars). Names with invalid characters return `400` with the regex pattern
- [ ] `--expires 0` or `--expires none` is rejected for non-service-account keys — all human-associated keys must have an expiry (max 365d)
- [ ] If the server clock is skewed by more than 5 minutes from NTP, key expiry checks log a `CLOCK_SKEW` warning (see story 113 for session management)
- [ ] Rate limiting on key creation: max 100 keys per hour to prevent abuse (see story 114)
- [ ] `openeye apikey export --format json > keys-backup.json` exports key metadata (never plaintext values) for disaster recovery
- [ ] Revoking the last key with `admin` scope requires `--confirm-last-admin` to prevent accidental lockout
- [ ] Timing attack on key verification: the LRU cache lookup is not constant-time — a cache hit vs. miss reveals whether a key prefix has been recently used. Cache responses should be timing-indistinguishable for valid vs. invalid keys
- [ ] LRU cache poisoning: an attacker submitting many invalid keys can evict valid entries from the 1000-entry LRU, causing legitimate requests to incur 250ms bcrypt penalty on every call. Cache should partition or use a separate negative-cache with shorter TTL
- [ ] Key exfiltration via memory dump: plaintext key shown at creation may remain in process memory, shell history, or terminal scrollback — `openeye apikey create` should advise piping output to a secrets manager
- [ ] `OPENEYE_API_KEY` environment variable visible in `/proc/<pid>/environ` on Linux — documentation should warn about this exposure vector and recommend using a key file or secrets manager instead
- [ ] Concurrent revoke + rotate race: if called simultaneously for the same key, rotate may create a new key while the old one is revoked, leaving a dangling deprecated key — define precedence behavior

### Technical Notes

- Key store implementation lives in `cli/openeye_ai/auth/keystore.py` using SQLite with WAL journal mode for concurrent read access
- Key hashing uses `bcrypt` with cost factor 12 — verification is ~250ms per request, cached in an LRU (max 1000 entries, 5-minute TTL) to avoid repeated bcrypt calls
- Key validation middleware lives in `server/middleware/auth.py` and runs before route handlers
- Dependencies: `bcrypt` (already in `cryptography` dependency tree), `sqlite3` (stdlib)
- The `--require-api-key` flag sets `OPENEYE_REQUIRE_API_KEY=true` which the FastAPI middleware checks

---

## 102. OAuth2 / OpenID Connect

**As an enterprise admin, I can configure OAuth2/OIDC identity providers (Okta, Auth0, Azure AD, Google Workspace) for single sign-on to the OpenEye API and dashboard.**

### Acceptance Criteria

- [ ] `openeye serve --oidc-issuer https://corp.okta.com/oauth2/default --oidc-client-id <id> --oidc-client-secret <secret>` enables OIDC authentication
- [ ] OIDC configuration is also supported via config file at `~/.openeye/auth.yaml` with an `oidc:` section to avoid secrets on the command line
- [ ] The server exposes `GET /auth/login` which redirects to the IdP's authorization endpoint with PKCE (code_challenge) for browser-based flows
- [ ] `GET /auth/callback` handles the authorization code exchange and issues an OpenEye session token (JWT, signed with `HS256` using the server's secret key)
- [ ] Machine-to-machine flows support OAuth2 client credentials grant: `POST /auth/token` with `grant_type=client_credentials`
- [ ] OIDC discovery is auto-configured via the `.well-known/openid-configuration` endpoint from the issuer URL
- [ ] ID token claims are mapped to OpenEye roles: `--oidc-role-claim groups` maps IdP group memberships to RBAC roles (see story 104)
- [ ] Custom claim mapping via config: `role_mapping: {"IdP-Admins": "admin", "IdP-Operators": "operator", "IdP-Viewers": "viewer"}`
- [ ] Multiple OIDC providers can be configured simultaneously for organizations using different IdPs across teams
- [ ] Tokens include `sub`, `email`, `name`, `roles`, `exp`, `iat`, `iss` claims — downstream middleware uses `roles` for authorization (see story 104)
- [ ] `openeye auth test --provider okta` validates the OIDC configuration by performing a discovery fetch and token validation dry run
- [ ] Refresh tokens are supported: when the access token expires, the client can use `/auth/refresh` to obtain a new access token without re-authentication (see story 113)
- [ ] `pip install openeye-ai[security]` installs `python-jose`, `authlib`, and `httpx` for OIDC support

### Edge Cases

- [ ] IdP is unreachable during login: returns `502 Bad Gateway` with `{"error": "identity_provider_unreachable", "provider": "okta"}` — does not hang or expose internal URLs
- [ ] IdP returns an invalid or expired ID token: rejects the login with `401` and logs the specific JWT validation failure (signature, expiry, audience mismatch) at `debug` level — never in the user-facing error
- [ ] OIDC provider rotates its signing keys (JWKS rotation): the server caches JWKS keys with a 1-hour TTL and re-fetches on `kid` mismatch — handles seamless key rotation without downtime
- [ ] User's IdP groups change (e.g., removed from "Admins"): on next token refresh, the new role mapping is applied — existing sessions reflect the change within the refresh interval
- [ ] `oidc-client-secret` is accidentally committed to a config file: `openeye serve` logs a warning if `auth.yaml` has world-readable permissions (`chmod 600` is recommended). Secrets can also be sourced from a secrets manager (see story 199)
- [ ] Clock skew between OpenEye server and IdP: JWT validation allows `--oidc-clock-skew` tolerance (default: 30s) to accommodate minor time differences
- [ ] If the `oidc-role-claim` field is missing from the ID token, the user is assigned the `viewer` role by default — configurable via `--oidc-default-role`
- [ ] Concurrent login storms (e.g., shift change with 100+ users): token issuance is rate-limited to prevent resource exhaustion (see story 114)
- [ ] PKCE code verifier mismatch (tampered callback): returns `400` with `{"error": "pkce_verification_failed"}` and logs the attempt as a potential attack in the audit log (see story 106)
- [ ] IdP sends a `sub` claim that conflicts with an existing local user: the OIDC identity is linked to the existing user record if emails match; otherwise a new user record is created with a namespaced ID (`okta:<sub>`)
- [ ] Token substitution attack: an attacker swaps the ID token from one OIDC provider for another in a multi-provider setup — token validation must verify the `iss` claim matches the expected provider for the initiated login flow
- [ ] JWT `aud` (audience) claim validation: tokens issued for a different client/audience must be rejected — `aud` verification must be enforced on all token endpoints
- [ ] Open redirect via `redirect_uri` manipulation: the callback URL must be strictly validated against a pre-registered allowlist — partial matches (e.g., `https://evil.com?redirect=https://legit.com/callback`) must be rejected
- [ ] IdP metadata discovery cache poisoning: if `.well-known/openid-configuration` is fetched over a compromised network, the cached JWKS URI could point to an attacker-controlled server — pin or validate JWKS URI against expected domains
- [ ] Token size exceeding HTTP header limits: OIDC tokens with many group claims can exceed typical 8KB header limits on reverse proxies — handle truncation gracefully or switch to reference token pattern

### Technical Notes

- OIDC middleware lives in `server/middleware/oidc.py` with provider-specific adapters in `server/middleware/oidc_providers/`
- JWT signing uses `python-jose` with `HS256` for self-issued tokens; `RS256` for IdP token verification
- OIDC state parameter is stored in a server-side session store (Redis if configured, otherwise in-memory with 10-minute expiry) to prevent CSRF
- Auth config schema is defined in `cli/openeye_ai/auth/config.py` as a Pydantic model for validation
- The OIDC flow is compatible with the dashboard frontend (see story 86 for REST API)

### Example Config

```yaml
# ~/.openeye/auth.yaml
oidc:
  providers:
    - name: okta
      issuer: https://corp.okta.com/oauth2/default
      client_id: 0oa1b2c3d4e5f6g7h8
      client_secret: ${OKTA_CLIENT_SECRET}  # resolved from env or secrets manager
      scopes: ["openid", "profile", "email", "groups"]
      role_claim: groups
      role_mapping:
        "OpenEye-Admins": admin
        "OpenEye-Operators": operator
        "OpenEye-Viewers": viewer
      default_role: viewer

    - name: azure-ad
      issuer: https://login.microsoftonline.com/<tenant-id>/v2.0
      client_id: <azure-client-id>
      client_secret: ${AZURE_CLIENT_SECRET}
      scopes: ["openid", "profile", "email"]
      role_claim: roles
```

---

## 103. SAML 2.0 SSO

**As an enterprise admin, I can configure SAML 2.0 identity providers for single sign-on to the OpenEye management API and dashboard.**

### Acceptance Criteria

- [ ] `openeye serve --saml-metadata-url https://corp.okta.com/app/<app-id>/sso/saml/metadata` enables SAML SSO by auto-fetching IdP metadata
- [ ] Alternatively, `--saml-metadata-file idp-metadata.xml` loads IdP metadata from a local file for air-gapped environments
- [ ] The OpenEye SP metadata is served at `GET /auth/saml/metadata` for registration with the IdP
- [ ] SP entity ID defaults to `https://<server-host>/auth/saml` and is configurable via `--saml-entity-id`
- [ ] `GET /auth/saml/login` initiates the SAML AuthnRequest flow, redirecting the user to the IdP with a signed request
- [ ] `POST /auth/saml/acs` (Assertion Consumer Service) handles the SAML Response, validates the assertion signature, and issues an OpenEye session token (JWT)
- [ ] `GET /auth/saml/slo` (Single Logout) initiates SAML LogoutRequest; `POST /auth/saml/slo` handles IdP-initiated logout
- [ ] SAML attribute-to-role mapping: `--saml-role-attribute Role` maps SAML attributes to OpenEye RBAC roles (see story 104) with a configurable mapping table
- [ ] Assertion signature validation supports RSA-SHA256 and RSA-SHA512 signing algorithms; SHA1 is rejected by default with `--saml-allow-sha1` to explicitly opt in (with a deprecation warning)
- [ ] SAML assertions must be encrypted if `--saml-require-encrypted-assertions` is set — unencrypted assertions are rejected with a `400`
- [ ] SP certificate and private key for signing/encryption are loaded from `--saml-sp-cert` and `--saml-sp-key` (default: `~/.openeye/saml/sp.crt` and `sp.key`)
- [ ] `openeye auth saml test` performs a metadata exchange validation and reports any configuration issues (missing attributes, certificate expiry, endpoint mismatches)
- [ ] SAML dependencies: `pip install openeye-ai[saml]` installs `python3-saml` (OneLogin's SAML toolkit)

### Edge Cases

- [ ] IdP metadata URL is unreachable on startup: retries 3 times with 5-second intervals, then falls back to a cached copy at `~/.openeye/cache/saml-metadata.xml` if available — logs a warning about stale metadata
- [ ] IdP certificate is about to expire (within 30 days): logs a `SAML_CERT_EXPIRY_WARNING` on each authentication with days remaining — the admin can preload the new cert via `--saml-idp-cert-next` for seamless rotation
- [ ] SAML Response replay attack: each assertion's `InResponseTo` and `ID` are tracked in a replay cache (in-memory, 10-minute window). Duplicate assertions are rejected with `403` and logged as a security event (see story 106)
- [ ] Clock skew between SP and IdP: `NotBefore` / `NotOnOrAfter` conditions allow `--saml-clock-skew` tolerance (default: 60s)
- [ ] Unsigned SAML assertions: rejected by default. `--saml-allow-unsigned` is required to accept them (with a security warning logged on each use)
- [ ] SAML attribute with multiple values (e.g., user in multiple groups): all values are collected and mapped to roles — the user receives the union of all matched roles
- [ ] IdP-initiated SSO (unsolicited SAML Response without a prior AuthnRequest): supported if `--saml-allow-idp-initiated` is set; disabled by default due to CSRF risk
- [ ] NameID format mismatch: if the IdP sends `transient` NameID but the SP expects `emailAddress`, logs a descriptive error with both the expected and received format
- [ ] SAML Response with no role attribute: user is assigned `--saml-default-role` (default: `viewer`). If `--saml-require-role-attribute` is set, authentication fails with a `403` explaining the missing attribute
- [ ] Large SAML responses (>100KB, common with many group claims): parsed with a streaming XML parser to avoid memory issues; responses exceeding `--saml-max-response-size` (default: 1MB) are rejected
- [ ] SP private key file permissions: if `sp.key` is world-readable (mode >600), the server logs a `SECURITY_WARNING` on startup
- [ ] XML Signature Wrapping (XSW) attacks: SAML responses are vulnerable to signature wrapping where a signed assertion is valid but a second unsigned assertion with modified attributes is injected — the XML parser must validate that the signed element is the one used for authentication
- [ ] XML External Entity (XXE) injection: the SAML response XML parser must disable external entity resolution and DTD processing — even `python3-saml` needs explicit configuration to prevent XXE
- [ ] XML bomb (Billion Laughs): the streaming parser handles large responses but does not protect against exponential entity expansion — limit entity expansion depth and count
- [ ] Replay cache in multi-replica deployment: the in-memory 10-minute replay cache is per-process — in a load-balanced deployment, an attacker can replay a SAML assertion to a different replica. Shared replay cache (Redis) is required for distributed deployments
- [ ] SAML RelayState parameter injection: the RelayState value returned from the IdP is used for redirect after authentication — if not validated against allowed URLs, it enables open redirect attacks

### Technical Notes

- SAML SP logic lives in `cli/openeye_ai/auth/saml.py` wrapping `python3-saml`
- SP certificates can be auto-generated on first run via `openeye auth saml init` (self-signed, 2-year validity)
- Assertion parsing extracts claims and feeds them into the same role-mapping pipeline as OIDC (story 102) — unified auth middleware in `server/middleware/auth.py`
- Session tokens issued after SAML authentication are identical in format to OIDC tokens (JWT with `roles` claim) — downstream middleware is auth-method-agnostic
- SLO uses HTTP-Redirect binding for SP-initiated logout and HTTP-POST binding for IdP-initiated logout

---

## 104. Role-Based Access Control (RBAC)

**As an enterprise admin, I can define roles (admin, operator, viewer, model-manager) with fine-grained permissions on resources so that users only access what they need.**

### Acceptance Criteria

- [ ] `openeye serve --rbac-policy policy.yaml` loads a role-based access control policy from a YAML file
- [ ] Four built-in roles are provided: `admin` (full access), `operator` (manage cameras, view streams, trigger inference), `viewer` (read-only access to detections and dashboards), `model-manager` (pull, deploy, and rollback models)
- [ ] Custom roles can be defined in the policy file with arbitrary names and permission sets
- [ ] Permissions are resource-scoped: `cameras:read`, `cameras:write`, `cameras:delete`, `models:read`, `models:deploy`, `models:delete`, `streams:read`, `streams:create`, `config:read`, `config:write`, `keys:manage`, `audit:read`, `users:manage`
- [ ] Wildcard permissions: `cameras:*` grants all camera permissions; `*:read` grants read access to all resources
- [ ] Resource-instance permissions: `cameras:read:warehouse-*` restricts camera read access to cameras matching the `warehouse-*` glob pattern
- [ ] Role assignments are stored in `~/.openeye/rbac.db` and managed via `openeye rbac assign --user alice@corp.com --role operator`
- [ ] `openeye rbac check --user alice@corp.com --permission cameras:write` tests whether a user has a specific permission (useful for CI/debugging)
- [ ] Role hierarchy: `admin` inherits all permissions from `operator`, which inherits from `viewer` — custom roles can also specify `inherits: [viewer]`
- [ ] RBAC integrates with OIDC (story 102) and SAML (story 103): roles from IdP claims are merged with locally assigned roles — local assignments take precedence
- [ ] `openeye rbac list-roles` displays all roles with their permissions; `openeye rbac list-users` displays all user-role assignments
- [ ] Policy changes are hot-reloaded: editing `policy.yaml` and sending `SIGHUP` to the server process reloads the policy without downtime
- [ ] All RBAC decisions are logged in the audit log (see story 106) with the user, requested permission, granted/denied result, and the role that provided or denied the permission

### Edge Cases

- [ ] User with no role assigned: all requests return `403 Forbidden` with `{"error": "no_role_assigned", "user": "alice@corp.com"}` — there is no implicit default role unless `--rbac-default-role viewer` is set
- [ ] Policy file has a syntax error: on startup, validation fails with a line-by-line error report. On hot-reload (`SIGHUP`), the invalid policy is rejected and the previous valid policy remains active with a warning logged
- [ ] Circular role inheritance (e.g., `roleA` inherits `roleB` which inherits `roleA`): detected at load time with a clear error listing the cycle
- [ ] Permission denied response includes the missing permission so the user (or their admin) knows what to request: `{"error": "permission_denied", "required": "models:deploy", "user_roles": ["viewer"]}`
- [ ] User has multiple roles with conflicting permissions (e.g., `operator` allows `cameras:write`, a custom `restricted-operator` denies `cameras:write:production-*`): deny rules take precedence over allow rules (deny-override policy)
- [ ] API key scopes (story 101) and RBAC roles are both enforced — a request must pass both checks. An API key with `predict` scope used by a user with `viewer` role can call `POST /predict` but not `POST /models/deploy`
- [ ] Deleting a role that has active user assignments: `openeye rbac delete-role custom-role` requires `--force` — without it, lists the affected users and refuses
- [ ] Role names are case-insensitive and normalized to lowercase. `Admin`, `ADMIN`, `admin` all resolve to the same role
- [ ] Tenant-scoped RBAC (see story 105): in multi-tenant mode, roles are namespaced per tenant — `tenant-a:admin` is separate from `tenant-b:admin`
- [ ] Policy file exceeds 10,000 lines (large enterprise): parsed with streaming YAML to avoid memory issues; validated incrementally with errors reported per-section
- [ ] Privilege escalation via wildcard interaction: `*:read` combined with resource-instance permissions like `cameras:*:warehouse-*` could create unexpected permission unions — define and test evaluation order for wildcard + deny rule combinations
- [ ] TOCTOU race on RBAC hot-reload: between `SIGHUP` triggering policy reload and the new policy being fully loaded, requests may be evaluated against a partially loaded policy — reload must be atomic (load fully, then swap reference)
- [ ] Permission check bypass via URL encoding: if route matching uses `/cameras/` but RBAC uses the raw URL path, `//cameras/` or `/cameras%2F` could bypass resource-instance permission checks
- [ ] Role assignment privilege escalation: the assigning user must not be able to grant roles with more permissions than they themselves possess — `openeye rbac assign` must verify this constraint

### Technical Notes

- RBAC engine lives in `cli/openeye_ai/auth/rbac.py` with the policy parser in `cli/openeye_ai/auth/rbac_policy.py`
- Permission checks are implemented as a FastAPI dependency (`Depends(require_permission("cameras:write"))`) injected into route handlers
- Role storage uses the same SQLite database as the key store (story 101) with a `user_roles` table
- Built-in policy is embedded in `cli/openeye_ai/auth/default_policy.yaml` and can be exported with `openeye rbac export-defaults`
- Glob matching for resource-instance permissions uses Python's `fnmatch` module

### Example Config

```yaml
# policy.yaml
roles:
  admin:
    description: "Full system access"
    permissions:
      - "*:*"

  operator:
    description: "Camera and stream management"
    inherits: [viewer]
    permissions:
      - "cameras:*"
      - "streams:*"
      - "models:read"

  viewer:
    description: "Read-only access"
    permissions:
      - "cameras:read"
      - "streams:read"
      - "models:read"
      - "audit:read"

  model-manager:
    description: "Model lifecycle management"
    inherits: [viewer]
    permissions:
      - "models:*"

  site-operator:
    description: "Operator scoped to specific camera groups"
    inherits: [viewer]
    permissions:
      - "cameras:*:warehouse-*"
      - "cameras:*:loading-dock-*"
      - "streams:*:warehouse-*"

deny_rules:
  - role: site-operator
    permissions:
      - "cameras:delete:*"
```

---

## 105. Multi-Tenant Isolation

**As a SaaS platform operator, I can run a single OpenEye deployment serving multiple tenant organizations with strict data isolation.**

### Acceptance Criteria

- [ ] `openeye serve --multi-tenant --tenant-config tenants.yaml` enables multi-tenant mode with per-tenant configuration
- [ ] Each tenant is identified by a unique `tenant_id` (slug format: `[a-z0-9-]+`, max 64 chars) included in all API requests via `X-Tenant-ID` header or JWT `tenant` claim
- [ ] Tenant data isolation: each tenant's models, detections, frames, audit logs, and config are stored in separate directories under `~/.openeye/tenants/<tenant_id>/`
- [ ] Database isolation: each tenant has its own SQLite databases (keys, RBAC, audit) — no cross-tenant queries are possible at the storage layer
- [ ] API isolation: a request with `tenant_id=acme` can never access data belonging to `tenant_id=globex` — enforced at the middleware layer before route handlers execute
- [ ] Per-tenant resource quotas: `max_cameras`, `max_models`, `max_api_keys`, `max_requests_per_minute`, `max_storage_mb` — configurable in `tenants.yaml`
- [ ] Per-tenant model allowlists: `allowed_models: [yolov8, grounding-dino]` restricts which models a tenant can deploy
- [ ] Tenant provisioning: `openeye tenant create --id acme --name "Acme Corp" --plan enterprise` creates a new tenant with directory structure and default config
- [ ] Tenant deprovisioning: `openeye tenant delete --id acme --confirm` removes all tenant data (with a 30-day soft-delete retention period before permanent deletion)
- [ ] Cross-tenant admin: the `platform-admin` role (distinct from tenant `admin`) can access all tenants' management APIs for operational support
- [ ] Tenant-scoped API keys: keys created within a tenant are bound to that tenant — they cannot be used to access other tenants' endpoints (see story 101)
- [ ] `openeye tenant list` displays all tenants with usage metrics: storage used, active cameras, API call count (last 24h), active users
- [ ] Tenant context is propagated in all log entries and audit events as a `tenant_id` field for centralized log filtering (see story 106)

### Edge Cases

- [ ] Request missing `X-Tenant-ID` header and no tenant claim in JWT: returns `400 Bad Request` with `{"error": "tenant_id_required"}` — does not fall back to a default tenant
- [ ] Request with an invalid or nonexistent `tenant_id`: returns `404 Not Found` with `{"error": "tenant_not_found", "tenant_id": "nonexistent"}` — does not reveal whether other tenants exist
- [ ] Tenant exceeds storage quota: new model pulls and frame snapshots are rejected with `507 Insufficient Storage` and `{"error": "tenant_storage_quota_exceeded", "used_mb": 950, "limit_mb": 1000}` — existing operations continue
- [ ] Tenant exceeds rate limit quota: returns `429 Too Many Requests` with per-tenant `Retry-After` header (see story 114)
- [ ] Tenant soft-delete window: during the 30-day retention period, `openeye tenant restore --id acme` re-activates the tenant. After 30 days, a background purge job permanently deletes the data
- [ ] Noisy neighbor prevention: a single tenant's heavy inference workload cannot starve other tenants — GPU time is fair-scheduled with configurable weights per tenant (`--tenant-gpu-weight`)
- [ ] Tenant migration: `openeye tenant export --id acme --output acme-backup.tar.gz` exports all tenant data for migration to another deployment
- [ ] SQL injection via `tenant_id`: the tenant ID is validated against the strict slug pattern before being used in any file path or database operation — path traversal attempts (e.g., `../../etc/passwd`) are rejected and logged as security events
- [ ] Tenant-scoped model cache: if two tenants use the same model (e.g., `yolov8`), the model files are shared read-only in `~/.openeye/models/` (not duplicated per tenant) — but inference state and configuration are isolated
- [ ] Platform admin accessing tenant data is logged as a separate audit event type (`PLATFORM_ADMIN_ACCESS`) with the admin's identity and the tenant accessed
- [ ] Concurrent tenant creation with the same ID: serialized via file lock — the second request fails with `409 Conflict`
- [ ] Symlink escape from tenant model directory: shared model storage uses symlinks from tenant dirs to global models — a tenant with write access could create symlinks pointing to other tenants' directories. Symlink resolution must be validated to stay within allowed paths
- [ ] Tenant ID reuse after deletion: if tenant `acme` is deleted and a new tenant `acme` is created within the 30-day soft-delete window, the new tenant could access old tenant data — creation must check for soft-deleted tenants with same ID
- [ ] Cross-tenant data leakage via error messages: internal errors referencing file paths like `~/.openeye/tenants/globex/models/...` could leak another tenant's ID or structure — error sanitization must strip tenant-specific paths
- [ ] Memory isolation: tenants sharing the same server process share memory — a tenant triggering OOM kills the entire server. Per-tenant memory limits or process isolation should be considered

### Technical Notes

- Tenant middleware lives in `server/middleware/tenant.py` — resolves tenant context from the request and injects it as a FastAPI dependency
- Tenant data directory layout: `~/.openeye/tenants/<id>/{keys.db, rbac.db, audit.db, models/, frames/, config/}`
- Shared model storage uses symlinks from tenant model dirs to the global `~/.openeye/models/` cache
- Tenant quotas are enforced in `cli/openeye_ai/auth/quotas.py` with a `QuotaEnforcer` class
- GPU fair-scheduling uses a weighted round-robin queue in `server/scheduler.py`
- Tenant config schema is defined in `cli/openeye_ai/auth/tenant_config.py` as a Pydantic model

### Example Config

```yaml
# tenants.yaml
tenants:
  - id: acme
    name: "Acme Corporation"
    plan: enterprise
    quotas:
      max_cameras: 50
      max_models: 10
      max_api_keys: 100
      max_requests_per_minute: 1000
      max_storage_mb: 10000
    allowed_models: ["yolov8", "grounding-dino", "depth-anything"]
    gpu_weight: 2

  - id: globex
    name: "Globex Industries"
    plan: standard
    quotas:
      max_cameras: 10
      max_models: 3
      max_api_keys: 20
      max_requests_per_minute: 200
      max_storage_mb: 2000
    allowed_models: ["yolov8"]
    gpu_weight: 1
```

---

## 106. Audit Logging

**As an enterprise compliance team member, I get immutable, structured audit logs of all API calls, auth events, model deployments, and config changes.**

### Acceptance Criteria

- [ ] `openeye serve --audit-log /var/log/openeye/audit.jsonl` enables audit logging to a JSONL file with one event per line
- [ ] Every audit event includes: `timestamp` (ISO 8601 UTC), `event_type`, `actor` (user email or API key name), `tenant_id` (if multi-tenant, story 105), `source_ip`, `resource`, `action`, `result` (success/failure), `details` (event-specific metadata)
- [ ] Event types logged: `AUTH_LOGIN`, `AUTH_LOGOUT`, `AUTH_FAILURE`, `API_CALL`, `MODEL_DEPLOY`, `MODEL_DELETE`, `CONFIG_CHANGE`, `KEY_CREATE`, `KEY_ROTATE`, `KEY_REVOKE`, `ROLE_ASSIGN`, `ROLE_REVOKE`, `TENANT_CREATE`, `TENANT_DELETE`, `RBAC_DENY`
- [ ] `AUTH_FAILURE` events include the failure reason (invalid key, expired token, wrong password, IdP rejection) without leaking the submitted credential
- [ ] `CONFIG_CHANGE` events include a before/after diff of the changed configuration fields (sensitive values are redacted to `***`)
- [ ] `API_CALL` events log: HTTP method, path, status code, response time, request size, response size — but never log request/response bodies (privacy)
- [ ] Audit log integrity: each event includes a `sequence_id` (monotonically increasing) and a `hmac` field — HMAC-SHA256 of the event JSON using a server-configured signing key (`--audit-signing-key` or `OPENEYE_AUDIT_SIGNING_KEY`)
- [ ] `openeye audit verify --file audit.jsonl --signing-key <key>` validates the HMAC chain and reports any tampered, missing, or out-of-sequence events
- [ ] Log rotation: `--audit-max-size 100MB --audit-max-files 30` rotates the audit log file when it reaches the size limit, keeping up to 30 rotated files
- [ ] Structured output supports forwarding to SIEM systems: Splunk (HEC), Elasticsearch, Datadog — via stdout (`--audit-log -`) for pipe-based ingestion or native forwarders
- [ ] `openeye audit search --actor alice@corp.com --event-type AUTH_FAILURE --from 2026-03-01 --to 2026-03-15` queries local audit logs with filtering
- [ ] `openeye audit export --format csv --output audit-report.csv` exports filtered audit logs for compliance reporting
- [ ] Audit logging is always-on in production mode (`openeye serve --production`) — cannot be disabled without `--no-audit --confirm-no-audit`

### Edge Cases

- [ ] Audit log disk full: when the filesystem has <100MB free, the server logs a `AUDIT_DISK_FULL` warning to stderr every 60 seconds and buffers audit events in memory (max 10,000 events). If memory buffer fills, the oldest events are dropped and a `AUDIT_EVENTS_DROPPED` counter is incremented in the next written event
- [ ] Audit log file is deleted while server is running: the server detects the missing file on next write, re-creates it, and logs an `AUDIT_FILE_RECREATED` event as the first entry — sequence IDs continue from the last known value
- [ ] High-throughput scenarios (>1000 API calls/sec): audit events are buffered in memory and flushed in batches every 100ms or 1000 events (whichever comes first) to avoid I/O bottleneck
- [ ] HMAC signing key rotation: `openeye audit rotate-key --new-key <key>` starts signing new events with the new key. A `KEY_ROTATED` event is written with both old and new key HMACs for verification chain continuity
- [ ] Tamper detection: `openeye audit verify` detects gaps in `sequence_id` (deleted events), HMAC mismatches (modified events), and duplicate sequence IDs (injected events) — reports each type separately
- [ ] Multi-process deployment (multiple `openeye serve` workers behind a load balancer): each worker gets a `worker_id` prefix on sequence IDs (`w1-00001`, `w2-00001`) to avoid conflicts — verification handles per-worker sequences
- [ ] Audit events containing PII (e.g., user email in `actor`): `--audit-anonymize` hashes the `actor` field with SHA-256 and a salt for privacy-sensitive deployments. The salt is stored in `~/.openeye/audit-salt` and must be preserved for consistent anonymization
- [ ] Timezone handling: all timestamps are UTC regardless of server timezone. If the server clock is adjusted (NTP correction), the audit log uses monotonic clock for event ordering and wall clock for the `timestamp` field
- [ ] `openeye audit verify` on a large file (>1GB): streams verification without loading the entire file into memory — reports progress every 100,000 events
- [ ] Concurrent writes from multiple threads: the audit logger uses a thread-safe queue with a single writer thread — events are ordered by queue insertion time
- [ ] Log injection via actor/resource fields: user emails or resource names containing newline characters or JSON-breaking characters could corrupt JSONL format or inject fake audit entries — all fields must be JSON-escaped before writing
- [ ] HMAC chain breakage on log rotation: when the log file rotates, the HMAC chain breaks — define how chain links across rotated files or how verification handles file boundaries
- [ ] Audit log as attack amplification vector: an attacker generating thousands of `AUTH_FAILURE` events can fill audit log disk faster than legitimate events — rate limiting on security events or separate storage quotas should be considered

### Technical Notes

- Audit logger implementation lives in `cli/openeye_ai/audit/logger.py` with the verification tool in `cli/openeye_ai/audit/verifier.py`
- HMAC chain: each event's HMAC includes the previous event's HMAC, creating a hash chain similar to blockchain — makes it impossible to delete or reorder events without detection
- Log rotation uses Python's `logging.handlers.RotatingFileHandler` with JSONL formatting
- SIEM integration docs reference common forwarder configs (Filebeat for Elasticsearch, Splunk UF, Datadog Agent) in the deployment guide
- Audit middleware lives in `server/middleware/audit.py` and wraps all route handlers

---

## 107. Data Encryption at Rest

**As an enterprise security officer, all stored data (models, frames, config, audit logs) is encrypted at rest using AES-256 with customer-managed keys (CMK) support.**

### Acceptance Criteria

- [ ] `openeye serve --encrypt-at-rest --encryption-key-file ~/.openeye/master.key` enables transparent encryption of all data written to disk
- [ ] Encryption uses AES-256-GCM with a unique data encryption key (DEK) per file, wrapped by the master key (envelope encryption pattern)
- [ ] Master key sources: local file (`--encryption-key-file`), AWS KMS (`--kms-key-id arn:aws:kms:...`), Google Cloud KMS (`--gcp-kms-key`), Azure Key Vault (`--azure-key-vault-key`), HashiCorp Vault Transit (`--vault-transit-key`) — see story 199 for secrets manager integration
- [ ] Encrypted file types: model weights (`.pt`, `.onnx`, `.engine`), captured frames (`.jpg`, `.png`), configuration databases (`keys.db`, `rbac.db`), audit logs (`.jsonl`), tenant data directories
- [ ] `openeye encrypt init` generates a new AES-256 master key and saves it to `~/.openeye/master.key` with `chmod 600` permissions
- [ ] Encrypted files include a header: magic bytes (`OEENC`), version (1 byte), wrapped DEK (encrypted with master key), IV (12 bytes), then AES-GCM ciphertext with authentication tag
- [ ] `openeye encrypt status` reports: encryption enabled/disabled, master key source, number of encrypted files, any unencrypted files that should be encrypted
- [ ] `openeye encrypt migrate` encrypts all existing unencrypted data files in-place — creates a backup before migration (`~/.openeye/pre-encryption-backup/`)
- [ ] Key rotation: `openeye encrypt rotate-key --new-key-file new-master.key` re-wraps all DEKs with the new master key without re-encrypting the data (fast operation)
- [ ] Performance: encryption/decryption adds <5% overhead on file I/O — AES-NI hardware acceleration is used when available
- [ ] KMS-backed keys: DEK wrapping/unwrapping calls KMS only once per file open (the wrapped DEK is cached in the file header) — no KMS call on every read/write
- [ ] `pip install openeye-ai[encryption]` installs `cryptography` (which provides AES-GCM via OpenSSL)

### Edge Cases

- [ ] Master key file is missing on startup: server refuses to start with `"Encryption is enabled but master key not found at ~/.openeye/master.key. Run 'openeye encrypt init' or provide --encryption-key-file"`
- [ ] Master key file has wrong permissions (world-readable): server starts but logs a `SECURITY_WARNING` on every startup until permissions are fixed to `600` or `400`
- [ ] KMS is unreachable on startup: retries 3 times with 2-second intervals. If KMS remains unreachable, fails with a clear error — does not fall back to unencrypted mode
- [ ] Encrypted file is corrupted (GCM authentication tag mismatch): read operation fails with `DataIntegrityError("File integrity check failed: <path>. File may be corrupted or tampered with.")` — does not silently return corrupted data
- [ ] Power failure during encryption migration: on next startup, `openeye encrypt migrate` detects partially migrated files (via a migration journal at `~/.openeye/encrypt-migration.journal`) and resumes from the last successfully encrypted file
- [ ] Key rotation interrupted: the rotation journal tracks which DEKs have been re-wrapped. Resuming `rotate-key` continues from where it left off — files are never left in an inconsistent state
- [ ] Multiple master keys (key rotation history): old wrapped DEKs include a `key_id` in the file header so the correct master key version is used for unwrapping — supports up to 10 historical key versions
- [ ] Encrypted SQLite databases: use SQLite's VFS (Virtual File System) layer for transparent encryption — all SQLite operations work normally (queries, WAL, etc.)
- [ ] Large model files (>1GB): encrypted in 64KB chunks with streaming AES-GCM — never loads the entire file into memory
- [ ] AWS KMS key deletion scheduled: `openeye encrypt status` checks the KMS key state on startup and warns if the key is scheduled for deletion (provides days remaining)
- [ ] Decryption performance on Jetson/ARM: AES-NI is not available on ARM; falls back to OpenSSL's AES implementation — performance impact is ~10-15% on ARM (logged as an info-level message on startup)
- [ ] DEK caching in memory: unwrapped DEKs must exist in memory during use but should be zeroized after file handle is closed — long-running processes may keep DEKs indefinitely, increasing exposure from memory dumps
- [ ] Swap file exposure: DEKs and master keys in process memory could be paged to swap — use `mlock()` on sensitive memory regions or document requirement for encrypted swap
- [ ] Encrypted file header forgery: the `OEENC` magic bytes and version byte could be crafted by an attacker — the GCM authentication tag validates ciphertext but the header should be included in authenticated additional data (AAD)

### Technical Notes

- Encryption layer lives in `cli/openeye_ai/security/encryption.py` with KMS provider adapters in `cli/openeye_ai/security/kms/`
- Envelope encryption: master key encrypts DEKs (AES-256 key wrap per RFC 3394); DEKs encrypt data (AES-256-GCM)
- Each file's DEK is unique (generated via `os.urandom(32)`) — compromising one file's DEK does not compromise others
- SQLite VFS encryption wrapper lives in `cli/openeye_ai/security/encrypted_vfs.py` using `apsw` for custom VFS support
- KMS providers implement a `KMSProvider` interface: `wrap_key(dek) -> wrapped_dek`, `unwrap_key(wrapped_dek) -> dek`
- Dependencies: `cryptography` (core), `boto3` (AWS KMS), `google-cloud-kms` (GCP), `azure-keyvault-keys` (Azure), `hvac` (Vault Transit)

---

## 108. Mutual TLS (mTLS)

**As an enterprise ops team member, I can enforce mutual TLS between all OpenEye components (server, CLI, cameras, gRPC clients) so that both client and server identities are cryptographically verified.**

### Acceptance Criteria

- [ ] `openeye serve --tls-cert server.crt --tls-key server.key --tls-ca ca.crt --mtls` enables mutual TLS — the server presents its certificate and requires a valid client certificate signed by the CA
- [ ] Client connections without a certificate or with an untrusted certificate are rejected at the TLS handshake layer with no HTTP response (connection reset)
- [ ] `openeye run --tls-cert client.crt --tls-key client.key --tls-ca ca.crt https://server:8000/predict` authenticates the CLI as a client with its certificate
- [ ] gRPC streams (see story 87) support mTLS via the same `--tls-cert`, `--tls-key`, `--tls-ca` flags on `openeye stream --grpc`
- [ ] Certificate CN (Common Name) or SAN (Subject Alternative Name) is extracted and used as the client identity in audit logs (see story 106) and RBAC (see story 104)
- [ ] `openeye tls init --ca` generates a self-signed CA certificate and key for development/testing — saved to `~/.openeye/tls/ca.crt` and `ca.key`
- [ ] `openeye tls issue --cn "worker-1" --ca-cert ca.crt --ca-key ca.key --output worker-1.crt` issues a client certificate signed by the CA
- [ ] CRL (Certificate Revocation List) support: `--tls-crl crl.pem` checks client certificates against a revocation list — revoked certificates are rejected at the TLS layer
- [ ] OCSP stapling support: `--tls-ocsp` enables OCSP stapling for real-time certificate revocation checking
- [ ] Minimum TLS version is configurable: `--tls-min-version 1.2` (default: TLS 1.2). TLS 1.0 and 1.1 are never allowed
- [ ] Cipher suite configuration: `--tls-ciphers "TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256"` — defaults to a hardened set excluding weak ciphers (no RC4, 3DES, NULL, export ciphers)
- [ ] `openeye tls verify --cert client.crt --ca ca.crt` validates a certificate chain and reports: issuer, subject, validity period, key usage, SAN entries

### Edge Cases

- [ ] Client certificate expires during a long-running WebSocket/gRPC stream: the existing connection continues until the next TLS renegotiation or reconnection — new connections with the expired cert are rejected. A warning is logged when a certificate is within 7 days of expiry
- [ ] CA certificate rotation: `--tls-ca` accepts multiple CA certificates (bundle) — during rotation, both old and new CAs are trusted. Clients presenting certificates signed by either CA are accepted
- [ ] Certificate with wrong key usage (e.g., server cert used as client cert): rejected with a TLS error and an audit log entry specifying the key usage mismatch
- [ ] Self-signed certificates (not signed by the configured CA): rejected even if the `--tls-ca` flag is not set — mTLS mode always requires CA validation. Use `--tls-allow-self-signed` for development (logs a `SECURITY_WARNING`)
- [ ] CRL file is stale (older than `--crl-max-age`, default: 24h): logs a warning and optionally fails-closed (`--crl-strict`) — rejecting all client connections until the CRL is refreshed
- [ ] OCSP responder unreachable: defaults to fail-open (allow the connection) with a warning. `--ocsp-strict` changes to fail-closed
- [ ] Certificate chain depth exceeds `--tls-max-chain-depth` (default: 3): connection is rejected to prevent overly complex certificate chains
- [ ] Client presents a certificate with a CN that maps to a deactivated user in RBAC: the TLS handshake succeeds (certificate is valid) but the HTTP/gRPC request returns `403` from the RBAC layer (see story 104)
- [ ] Hot-reloading TLS certificates: sending `SIGHUP` to the server reloads `--tls-cert` and `--tls-key` without dropping existing connections — new connections use the new certificate
- [ ] Certificate with SAN containing wildcards (e.g., `*.corp.com`): accepted for server certificates only; wildcard client certificates are rejected as a security risk
- [ ] TLS renegotiation attacks: TLS 1.2 allows renegotiation used for DoS and MITM — `--tls-disable-renegotiation` should be available and enabled by default (TLS 1.3 removes renegotiation)
- [ ] Client certificate with empty CN and no SAN: identity extraction for RBAC mapping would fail — define behavior: reject the certificate or fall back to certificate serial number
- [ ] Missing intermediate CA certificate in client's chain: TLS handshake fails with a cryptic error — server should log a diagnostic message identifying the missing intermediate

### Technical Notes

- TLS configuration lives in `server/tls.py` wrapping Python's `ssl` module and `uvicorn`'s SSL context
- mTLS enforcement is at the transport layer — no application-level code can bypass it
- Certificate identity extraction for RBAC mapping lives in `server/middleware/mtls_identity.py`
- For gRPC, TLS is configured via `grpc.ssl_channel_credentials` and `grpc.ssl_server_credentials` with `require_client_auth=True`
- `openeye tls init` and `openeye tls issue` use the `cryptography` library's X.509 module
- Default cipher suites are based on Mozilla's "Modern" TLS configuration

---

## 109. IP Allowlisting & Network Policies

**As an enterprise admin, I can restrict API access to specific IP ranges / CIDR blocks so that only authorized networks can reach the OpenEye server.**

### Acceptance Criteria

- [ ] `openeye serve --ip-allowlist 10.0.0.0/8,172.16.0.0/12,192.168.1.0/24` restricts API access to the specified CIDR ranges
- [ ] IP allowlists can also be loaded from a file: `--ip-allowlist-file allowlist.txt` with one CIDR block per line (comments with `#`)
- [ ] Requests from non-allowlisted IPs are rejected at the middleware layer with `403 Forbidden` and `{"error": "ip_not_allowed", "client_ip": "1.2.3.4"}` — the response is minimal to avoid information leakage
- [ ] `GET /health` is exempt from IP allowlisting by default (for load balancer health checks) — configurable via `--ip-allowlist-exempt /health,/docs`
- [ ] IPv6 CIDR blocks are supported: `--ip-allowlist "2001:db8::/32,::1/128"`
- [ ] Per-tenant IP allowlists (see story 105): each tenant in `tenants.yaml` can specify `ip_allowlist: [...]` — enforced in addition to the global allowlist
- [ ] Per-API-key IP restrictions: `openeye apikey create --name prod --allowed-ips 10.0.1.0/24` binds a key to specific source IPs (see story 101)
- [ ] `openeye serve --ip-denylist 1.2.3.4,5.6.7.0/24` explicitly blocks specific IPs — denylist is evaluated before allowlist (deny takes precedence)
- [ ] IP ranges are reloaded on `SIGHUP` without server restart — allows dynamic updates from network policy changes
- [ ] Proxy-aware: `--trust-proxy-headers` extracts the client IP from `X-Forwarded-For` or `X-Real-IP` headers when behind a reverse proxy — configurable trusted proxy IPs via `--trusted-proxies 10.0.0.1,10.0.0.2`
- [ ] `openeye network test --ip 10.0.1.50` checks whether a given IP would be allowed or denied under the current policy
- [ ] All IP-based rejections are logged in the audit log (see story 106) with the denied IP, the requested endpoint, and the policy rule that triggered the denial

### Edge Cases

- [ ] `X-Forwarded-For` header spoofing: when `--trust-proxy-headers` is enabled without `--trusted-proxies`, the server logs a `SECURITY_WARNING` on startup — attackers can forge the header. Only the rightmost entry from a trusted proxy is used
- [ ] Request from `127.0.0.1` (localhost): allowed by default even when an allowlist is configured — configurable via `--ip-allowlist-include-localhost false` to lock down local access
- [ ] Empty allowlist (all IPs removed): the server rejects all requests except exempt endpoints. `openeye serve` logs a `WARNING` on startup if the allowlist is empty
- [ ] Overlapping CIDR blocks (e.g., `10.0.0.0/8` and `10.0.1.0/24` both in the denylist): the most specific match wins. If an IP matches both an allow and deny rule at the same specificity, deny wins
- [ ] IPv4-mapped IPv6 addresses (e.g., `::ffff:10.0.0.1`): normalized to IPv4 for allowlist matching — the user does not need to duplicate rules for both formats
- [ ] Allowlist file is deleted or becomes unreadable after startup: the previously loaded allowlist remains in effect. A `SIGHUP` reload with a missing file logs an error and keeps the current policy
- [ ] Rate of denied requests from a single IP exceeds `--ip-ban-threshold` (default: 100 denials/minute): the IP is temporarily blocked at the connection level (no HTTP response) for `--ip-ban-duration` (default: 15 minutes) to mitigate scanning attacks
- [ ] CIDR block `0.0.0.0/0` in the allowlist: equivalent to "allow all" — the server logs a `WARNING` that the allowlist is effectively disabled
- [ ] DNS-based allowlisting is not supported (intentionally): IP addresses can change, and DNS resolution adds latency and attack surface. The error message when a hostname is provided suggests resolving it to a CIDR block
- [ ] Load balancer PROXY protocol: `--proxy-protocol` supports HAProxy PROXY protocol v1/v2 for extracting the real client IP when TLS is terminated at the load balancer
- [ ] IPv6 link-local addresses (`fe80::/10`): should be treated like private addresses and handled consistently with or without allowlisting
- [ ] Source IP in container/Kubernetes environments: source IP may be the K8s node IP or service mesh proxy IP, not the actual client — document required configuration for common orchestration platforms
- [ ] Allowlist bypass via IPv4/IPv6 dual-stack: if server listens on both but allowlist only contains IPv4, IPv6 connections may bypass — ensure both address families are covered or warn on startup

### Technical Notes

- IP filtering middleware lives in `server/middleware/ip_filter.py` using Python's `ipaddress` module for CIDR matching
- IP matching uses a radix tree (prefix tree) for O(log n) lookup performance with large allowlists (>1000 entries)
- Temporary IP bans are stored in an in-memory dictionary with TTL — not persisted across server restarts
- Proxy header extraction follows RFC 7239 (`Forwarded`) and the de facto `X-Forwarded-For` standard
- Integration with cloud provider security groups (AWS SG, GCP Firewall Rules) is documented but handled at the infrastructure layer, not by OpenEye

---

## 110. Vulnerability Scanning & CVE Management

**As a security team member, I get automated CVE scanning of OpenEye Docker images and dependencies so that known vulnerabilities are identified and tracked.**

### Acceptance Criteria

- [ ] `openeye security scan` runs a vulnerability scan of all installed Python dependencies against the OSV (Open Source Vulnerability) and NVD databases
- [ ] Scan output reports: CVE ID, severity (CRITICAL/HIGH/MEDIUM/LOW), affected package, installed version, fixed version (if available), and a brief description
- [ ] `openeye security scan --format json > report.json` outputs machine-readable results for CI/CD integration
- [ ] `openeye security scan --fail-on high` exits with code 1 if any HIGH or CRITICAL vulnerabilities are found — suitable as a CI gate
- [ ] Docker images (`ghcr.io/openeye-ai/openeye:latest`) include a Software Bill of Materials (SBOM) in SPDX format at `/sbom.spdx.json`
- [ ] CI/CD pipeline runs Trivy or Grype on every Docker image build and blocks release if CRITICAL CVEs are found in the base image or dependencies
- [ ] `openeye security sbom` generates an SBOM (SPDX or CycloneDX format) for the currently installed `openeye-ai` package and all transitive dependencies
- [ ] Vulnerability database is updated automatically on each scan (`--offline` flag disables network access and uses the last cached DB at `~/.openeye/vuln-db/`)
- [ ] `openeye security advisories` lists all published security advisories for `openeye-ai` from the GitHub Security Advisories database
- [ ] Known false positives or accepted risks can be suppressed via `~/.openeye/vuln-allowlist.yaml` with CVE ID, justification, and expiry date
- [ ] Nightly scheduled scan: `openeye security scan --schedule "0 2 * * *"` runs a cron-style scheduled scan and sends results to a configured webhook (see story 195)
- [ ] Container image signing: Docker images are signed with Cosign (Sigstore) — `cosign verify ghcr.io/openeye-ai/openeye:latest` validates image provenance

### Edge Cases

- [ ] Vulnerability database unreachable (air-gapped environment): uses cached database with a `VULN_DB_STALE` warning showing the age of the cached data. If no cached database exists, `--offline` mode exits with a clear error
- [ ] Transitive dependency vulnerability (e.g., CVE in `pillow` pulled by `openeye-ai`): clearly reports the dependency chain: `openeye-ai -> transformers -> pillow` so the user understands the exposure path
- [ ] False positive in a dependency that is imported but not used in the vulnerable code path: allowlist entries support a `reason: "code_path_not_reachable"` justification — flagged differently in reports than fully accepted risks
- [ ] Multiple CVEs for the same package: grouped by package in the output for readability — not listed as separate entries that clutter the report
- [ ] SBOM generation for packages installed from git (e.g., `pip install git+https://...`): includes the git commit SHA as the version identifier, not "0.0.0" or "unknown"
- [ ] Docker base image (`python:3.11-slim`) has CVEs in OS packages: scan includes both Python package and OS-level (dpkg/apk) vulnerability results. `--python-only` flag restricts to Python packages only
- [ ] Allowlist entry has expired: the CVE is re-reported with a `ALLOWLIST_EXPIRED` flag — the user must re-evaluate and re-suppress or remediate
- [ ] CVE with no fixed version available: reported with `fix_version: null` and a `MITIGATION` section with recommended workarounds (if available from the advisory)
- [ ] Scanning detects a CRITICAL CVE in the `openeye-ai` package itself: the report includes a prominent `UPGRADE REQUIRED` banner with the fixed version and upgrade command (`pip install --upgrade openeye-ai`)
- [ ] Rate limiting from vulnerability databases (NVD API): handles `429` responses with backoff and caches results aggressively (24-hour TTL per CVE lookup)
- [ ] SBOM completeness for native/C extensions: Python packages with compiled C extensions (numpy, pillow) may include native libraries not captured by Python-level SBOM tools — validate SBOM against `ldd` output
- [ ] SBOM for GPU-specific dependencies: CUDA, cuDNN, TensorRT libraries may have CVEs but are not Python packages — ensure scan covers runtime dependencies
- [ ] Cosign signature verification in air-gapped environments: Sigstore's keyless signing relies on Fulcio/Rekor — air-gapped deployments need alternative verification (pre-distributed public key)

### Technical Notes

- Scanning engine lives in `cli/openeye_ai/security/scanner.py` using `pip-audit` (Google's Python vulnerability scanner) as the core engine
- SBOM generation uses `syft` (Anchore) for CycloneDX and SPDX output formats
- Docker image scanning in CI uses Trivy with the `.trivyignore` file for accepted risks
- Vulnerability allowlist schema is defined in `cli/openeye_ai/security/vuln_allowlist.py`
- Cosign signatures are generated in the CI/CD release pipeline (GitHub Actions) using keyless signing with Fulcio/Rekor
- OS-level scanning uses `trivy fs /` inside the container; Python scanning uses `pip-audit` against the installed packages

---

## 111. SOC 2 Compliance Controls

**As an enterprise compliance officer, I get built-in controls mapping to SOC 2 Type II trust service criteria so that OpenEye deployments meet audit requirements.**

### Acceptance Criteria

- [ ] `openeye compliance soc2 report` generates a compliance posture report mapping OpenEye's security controls to SOC 2 trust service criteria (Security, Availability, Processing Integrity, Confidentiality, Privacy)
- [ ] The report evaluates: access controls (stories 101–104), encryption (story 107), audit logging (story 106), network security (stories 108–109), vulnerability management (story 110), data retention (story 112), session management (story 113)
- [ ] Each control is assessed as `PASS`, `FAIL`, or `MANUAL_REVIEW` with specific remediation instructions for failures
- [ ] `openeye compliance soc2 report --format pdf --output soc2-report.pdf` generates a formatted PDF suitable for auditor review
- [ ] `openeye compliance soc2 report --format json` generates machine-readable output for GRC (Governance, Risk, Compliance) tool integration
- [ ] CC6.1 (Logical Access): verifies API key authentication or OIDC/SAML is enabled, RBAC policy is loaded, and no default/weak credentials exist
- [ ] CC6.2 (System Credentials): verifies key rotation policies are configured, minimum key length requirements are met, and expired keys are revoked
- [ ] CC6.3 (Authorized Access): verifies IP allowlisting is configured, mTLS is enabled (or documents why it is not), and rate limiting is active
- [ ] CC7.1 (Detection of Threats): verifies vulnerability scanning is configured, audit logging is enabled with integrity verification, and security event alerting is active
- [ ] CC7.2 (Incident Response): verifies webhook alerting is configured for security events (story 195), and audit logs are being forwarded to a SIEM
- [ ] A8.1 (Confidentiality Commitments): verifies encryption at rest is enabled, TLS is enforced for all connections, and data retention policies are configured
- [ ] `openeye compliance soc2 continuous` runs continuous compliance monitoring — checks controls every hour and publishes results to the audit log and optionally a webhook
- [ ] Control evidence collection: each check gathers machine-verifiable evidence (config file hashes, policy snapshots, encryption status) stored in `~/.openeye/compliance/evidence/`

### Edge Cases

- [ ] Partial compliance (some controls pass, some fail): the report clearly separates passing and failing controls with `FAIL` items at the top — the overall status is `NON_COMPLIANT` if any critical control fails
- [ ] Controls that require manual verification (e.g., "physical security of the data center"): listed as `MANUAL_REVIEW` with a description of what the auditor should verify and a space for the auditor's attestation in the PDF report
- [ ] Config changes between compliance report runs: the report includes a diff section showing controls that changed status (PASS -> FAIL or vice versa) since the last report
- [ ] Multi-tenant deployment (story 105): compliance report can be scoped to a specific tenant (`--tenant acme`) or generated as a platform-wide report covering all tenants
- [ ] Air-gapped environment: compliance checks work offline — no external API calls required. SOC 2 criteria definitions are bundled with the package
- [ ] Custom controls: `--soc2-custom-controls controls.yaml` allows organizations to add company-specific controls that are evaluated alongside the built-in SOC 2 mapping
- [ ] Evidence tampering detection: evidence files are integrity-checked using the same HMAC chain as audit logs (story 106) — tampered evidence is flagged in the report
- [ ] Compliance report generation fails mid-way (e.g., OOM on large deployments): partial report is saved with a `REPORT_INCOMPLETE` status and a list of unchecked controls
- [ ] SOC 2 criteria updates: when AICPA updates the trust service criteria, `openeye-ai` package updates include the revised control mappings — the compliance engine version is shown in the report header
- [ ] Concurrent compliance report requests: serialized to avoid conflicting evidence collection — the second request waits for the first to complete
- [ ] False PASS on controls: if compliance check only verifies a config flag is set (e.g., `--encrypt-at-rest`) but does not verify encryption is working, the control could pass while the measure is broken — controls should include functional verification
- [ ] Compliance report as attack target: if an attacker can trigger `openeye compliance soc2 report`, they can observe failing controls — compliance endpoints must require admin authorization and be rate-limited
- [ ] Stale data in reports: if report generation takes 10 minutes, first controls checked may be stale by completion — include per-control timestamps, not just one report timestamp

### Technical Notes

- Compliance engine lives in `cli/openeye_ai/compliance/soc2.py` with control checks in `cli/openeye_ai/compliance/controls/`
- Each control is implemented as a `ComplianceCheck` class with `evaluate() -> ComplianceResult` method
- PDF generation uses `reportlab` (optional dependency: `pip install openeye-ai[compliance]`)
- Control-to-criteria mapping is defined in `cli/openeye_ai/compliance/soc2_mapping.yaml`
- Evidence is stored as timestamped JSON files with HMAC integrity: `~/.openeye/compliance/evidence/<timestamp>-<control-id>.json`
- Continuous monitoring uses `apscheduler` for cron-style scheduling within the server process

---

## 112. GDPR / Data Privacy Controls

**As an enterprise Data Protection Officer (DPO), I can configure data retention, anonymization, and right-to-erasure for detection data containing personal data.**

### Acceptance Criteria

- [ ] `openeye serve --data-retention 30d` automatically deletes detection data (frames, detections, audit references) older than 30 days
- [ ] Data retention is configurable per data type: `--retention-frames 7d --retention-detections 90d --retention-audit 365d` (audit logs have a separate, longer retention by default)
- [ ] `openeye privacy anonymize --input frames/ --output anonymized/` applies face blurring and license plate redaction to all stored frames using a built-in anonymization model
- [ ] Real-time anonymization: `openeye watch --anonymize faces,plates` applies anonymization before any frame data is stored or forwarded — the original frame with PII never touches disk
- [ ] Data Subject Access Request (DSAR): `openeye privacy export --subject "person-id-123" --output dsar-export/` exports all stored data associated with a specific subject (detections, frames, metadata) in a portable format (JSON + images ZIP)
- [ ] Right to Erasure: `openeye privacy erase --subject "person-id-123" --confirm` permanently deletes all data associated with a subject — including audit log references (replaced with `"[REDACTED]"` rather than deleted to preserve log integrity)
- [ ] Data Processing Impact Assessment (DPIA) template: `openeye privacy dpia` generates a pre-filled DPIA template for computer vision deployments, covering lawful basis, necessity, risks, and safeguards
- [ ] Consent management: `--require-consent-banner` adds a privacy notice to the API response headers (`X-Privacy-Notice-URL`) and requires callers to acknowledge data processing
- [ ] Data minimization: `--minimize-data` stores only detection metadata (labels, bounding boxes, confidence) without raw frames — reducing PII exposure
- [ ] Processing purpose limitation: `--data-purpose "safety,security"` tags all stored data with the declared processing purpose, enforced in data access controls
- [ ] `openeye privacy audit` generates a privacy audit report showing: data types stored, retention periods, anonymization status, pending DSARs, erasure requests processed
- [ ] Anonymization models are bundled: face detection uses a lightweight RetinaFace model; plate detection uses a specialized LPD model — no external API calls for anonymization

### Edge Cases

- [ ] Retention policy deletes data that is referenced by an open DSAR export: DSARs are processed before the retention purge runs — a grace period of `--dsar-grace-period 7d` delays deletion of data with pending DSARs
- [ ] Anonymization model fails to detect a face (false negative): `--anonymize-fallback blur-all` applies a full-frame blur if the anonymization model confidence is below `--anonymize-min-confidence` (default: 0.3) — errs on the side of privacy
- [ ] Subject re-identification after anonymization: face blurring uses Gaussian blur with a kernel size that prevents reconstruction (minimum 51px) — not pixelation, which can be reversed with super-resolution models
- [ ] Erasure request for a subject that spans multiple tenants (story 105): the erasure is scoped to the requesting tenant only — cross-tenant erasure requires platform admin authorization
- [ ] Retention purge on encrypted data (story 107): the purge job has access to the decryption key to identify and delete the correct files — file metadata (timestamps) is stored unencrypted for efficient purge queries
- [ ] Audit log entries referencing erased data: the `actor` and `details` fields are replaced with `"[ERASED_GDPR_ART17]"` and the erasure event itself is logged as a new audit entry with the erasing admin's identity
- [ ] Bulk erasure (e.g., "delete all data from camera X for the past year"): supported via `openeye privacy erase --source camera-x --from 2025-03-01 --to 2026-03-01` — requires `--confirm-bulk` to prevent accidental mass deletion
- [ ] Anonymization of already-compressed JPEG frames: decompresses, applies blur, re-compresses — the output quality matches the input quality (JPEG quality factor is preserved)
- [ ] Data retention across multiple storage backends (local disk, S3, database): the purge job covers all configured storage backends — each backend implements a `purge(before_date)` method
- [ ] Right to rectification (GDPR Art. 16): `openeye privacy rectify --subject "person-id-123" --field label --value "authorized_personnel"` corrects misclassifications — the original and corrected values are both logged in the audit trail
- [ ] Anonymization bypass via EXIF metadata: EXIF data in frames may contain GPS coordinates, timestamps, or camera identifiers that re-identify subjects even after face blurring — frame anonymization should strip EXIF metadata
- [ ] Right to erasure vs. legal hold: if data is under legal hold, erasure requests must be denied or deferred — no legal hold mechanism is defined
- [ ] Erasure verification: after `openeye privacy erase`, no verification confirms all copies removed (including backups, caches, SIEM-forwarded audit logs) — generate an erasure verification report
- [ ] Anonymization model bias: RetinaFace may have lower detection accuracy for certain demographics (skin tone, age), creating unequal privacy protection — document accuracy across demographics

### Technical Notes

- Privacy controls live in `cli/openeye_ai/privacy/` with modules: `retention.py`, `anonymizer.py`, `dsar.py`, `erasure.py`
- Face anonymization uses RetinaFace (lightweight variant, ~5MB) from `insightface` — bundled as a dependency in `pip install openeye-ai[privacy]`
- License plate anonymization uses a custom YOLO-NAS model trained on plate detection — bundled separately (`~10MB`)
- Retention purge runs as a background task in the server process (configurable interval: `--purge-interval 1h`)
- DSAR export format follows the EU's recommended portable data format guidelines (JSON + referenced media files)
- Erasure uses secure file deletion (overwrite with zeros, then delete) when `--secure-erase` is set; otherwise standard `os.remove()`

### Example Config

```yaml
# ~/.openeye/privacy.yaml
retention:
  frames: 7d
  detections: 90d
  audit_logs: 365d
  purge_interval: 1h

anonymization:
  enabled: true
  targets: [faces, license_plates]
  min_confidence: 0.3
  fallback: blur-all
  blur_kernel_size: 51

data_minimization:
  store_frames: false
  store_detections: true
  store_metadata: true

processing_purposes:
  - safety
  - security
```

---

## 113. Session Management & Token Lifecycle

**As an enterprise admin, I can configure session timeouts, refresh token policies, and concurrent session limits so that user access is tightly controlled.**

### Acceptance Criteria

- [ ] `openeye serve --session-timeout 30m` sets the access token TTL to 30 minutes (default: 1 hour)
- [ ] `openeye serve --refresh-token-ttl 7d` sets the refresh token TTL to 7 days (default: 30 days)
- [ ] `openeye serve --max-concurrent-sessions 3` limits each user to 3 active sessions — the 4th login invalidates the oldest session
- [ ] Access tokens are JWTs (signed with the server's secret key) containing: `sub`, `email`, `roles`, `tenant_id`, `session_id`, `exp`, `iat`, `jti` (unique token ID)
- [ ] Refresh tokens are opaque (random 64-byte hex strings) stored server-side in the session store (`~/.openeye/sessions.db`) — hashed with SHA-256 before storage
- [ ] `POST /auth/refresh` accepts a refresh token and returns a new access token + refresh token pair (refresh token rotation) — the old refresh token is immediately invalidated
- [ ] `POST /auth/logout` invalidates the current session's access token and refresh token — subsequent use of either returns `401`
- [ ] `POST /auth/logout-all` invalidates all sessions for the current user — useful for password/credential changes
- [ ] Session store tracks: `session_id`, `user_id`, `created_at`, `last_active`, `ip_address`, `user_agent`, `refresh_token_hash`, `revoked`
- [ ] `openeye session list --user alice@corp.com` displays all active sessions with their metadata (admin-only)
- [ ] `openeye session revoke --session-id <id>` revokes a specific session (admin-only) — the user's next API call returns `401` with `{"error": "session_revoked"}`
- [ ] Absolute session lifetime: `--max-session-lifetime 24h` forces re-authentication after 24 hours regardless of activity — prevents indefinite session extension via refresh
- [ ] Idle timeout: `--idle-timeout 15m` invalidates sessions with no API activity for 15 minutes (tracked via `last_active` in session store)

### Edge Cases

- [ ] Refresh token reuse detection: if a previously rotated refresh token is used again, the server assumes the token was stolen — all sessions for that user are immediately revoked and a `TOKEN_REPLAY_DETECTED` security event is logged (see story 106)
- [ ] Clock skew between server and client: JWTs include a `nbf` (not before) claim set to `iat - 30s` to handle minor clock differences — configurable via `--token-clock-skew` (default: 30s)
- [ ] Session store database corruption: on startup, validates the sessions table schema. If corrupted, backs up the file and creates a fresh database — all existing sessions are invalidated (users must re-authenticate)
- [ ] Concurrent session limit with multiple login methods (OIDC + SAML + API key): API key sessions are excluded from the concurrent session count (they are managed separately, see story 101). Only interactive user sessions are counted
- [ ] Token issued just before a role change (RBAC update, story 104): the old token retains the old roles until it expires — `--rbac-enforce-on-refresh` forces role re-evaluation on every token refresh
- [ ] Server restart: the session store persists on disk — active sessions survive a restart. In-memory token blacklist (for revoked tokens not yet expired) is rebuilt from the session store on startup
- [ ] High session churn (>1000 sessions created/sec during shift change): session creation is rate-limited per user (`--max-logins-per-minute`, default: 10). Excess login attempts return `429`
- [ ] Distributed deployment (multiple server replicas): session store must be shared — `--session-store redis://redis:6379/0` uses Redis instead of local SQLite for cross-replica session consistency
- [ ] Refresh token TTL longer than max session lifetime: `--refresh-token-ttl` is automatically capped to `--max-session-lifetime` with a warning logged
- [ ] User is deleted while they have active sessions: all sessions for the user are immediately revoked. A background job purges orphaned sessions every hour
- [ ] JWT secret key rotation: if the signing secret is rotated, all existing access tokens become invalid simultaneously — define a grace period where both old and new secrets are accepted
- [ ] Session fixation attack: `session_id` must be regenerated on successful authentication — using a pre-authentication session ID enables hijacking
- [ ] JWS/JWE algorithm confusion: if server accepts both HS256 and RS256, an attacker could forge a token using the public RSA key as HMAC secret — enforce expected algorithm at verification time, never derive from token header alone

### Technical Notes

- Session management lives in `cli/openeye_ai/auth/sessions.py` with the session store abstraction in `cli/openeye_ai/auth/session_store.py`
- JWT encoding/decoding uses `python-jose` with `HS256` (shared secret) or `RS256` (asymmetric, for distributed deployments)
- Session store backends: `SQLiteSessionStore` (default), `RedisSessionStore` (for distributed deployments, requires `redis` package)
- Refresh token rotation follows IETF RFC 6749 Section 10.4 and the OAuth 2.0 Security Best Current Practice (draft-ietf-oauth-security-topics)
- Token blacklist for revoked-but-not-expired tokens uses an in-memory set with TTL matching the token's remaining lifetime — synced from the session store on startup
- Idle timeout tracking updates `last_active` on every authenticated API call — debounced to every 60 seconds to avoid excessive database writes

---

## 114. Rate Limiting & Abuse Prevention

**As an enterprise admin, I can configure per-user, per-API-key, and per-tenant rate limits so that the system is protected from abuse and resource exhaustion.**

### Acceptance Criteria

- [ ] `openeye serve --rate-limit 100/minute` sets a global rate limit of 100 requests per minute per client (identified by IP or API key)
- [ ] Per-endpoint rate limits: `--rate-limit-predict 30/minute --rate-limit-stream 5/minute --rate-limit-admin 60/minute` sets endpoint-specific limits
- [ ] Per-API-key rate limits: `openeye apikey create --name prod --rate-limit 500/minute` overrides the global limit for a specific key (see story 101)
- [ ] Per-tenant rate limits: configured in `tenants.yaml` as `max_requests_per_minute` (see story 105) — enforced independently of per-user limits
- [ ] Rate limit responses return `429 Too Many Requests` with standard headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` (Unix timestamp), `Retry-After` (seconds)
- [ ] Rate limiting algorithm: sliding window log (precise) or token bucket (configurable via `--rate-limit-algorithm sliding-window|token-bucket`) — default: sliding window
- [ ] Burst allowance: `--rate-limit-burst 20` allows short bursts above the sustained rate (token bucket only) — useful for batch API calls
- [ ] `openeye serve --rate-limit-config limits.yaml` loads a comprehensive rate limit configuration from a YAML file
- [ ] Rate limit bypass: `--rate-limit-exempt-keys admin-key-1,monitoring-key` exempts specific API keys from rate limiting (for admin and monitoring tools)
- [ ] Request cost weighting: `POST /predict/batch` counts as N requests (where N = batch size) against the rate limit — prevents batch endpoint abuse
- [ ] `openeye ratelimit status` displays current rate limit counters for all active clients (admin-only)
- [ ] Rate limit metrics are exposed via Prometheus endpoint (`GET /metrics`) for monitoring and alerting: `openeye_ratelimit_hits_total`, `openeye_ratelimit_rejected_total`

### Edge Cases

- [ ] Distributed deployment (multiple server replicas): rate limit counters must be shared — `--rate-limit-backend redis://redis:6379/1` uses Redis for distributed counting. Without Redis, each replica enforces limits independently (effectively multiplying the allowed rate by replica count, logged as a warning)
- [ ] Redis unavailable: falls back to in-memory rate limiting with a `RATELIMIT_DEGRADED` warning — per-replica limits apply. When Redis recovers, counters are reset (clients may get a burst of extra capacity)
- [ ] Client changes API key mid-stream to circumvent rate limits: each key has its own counter, but `--rate-limit-per-ip` also enforces a per-IP limit as a secondary control — both must pass
- [ ] `POST /predict/batch` with 1000 images: the batch size is counted against the rate limit before processing begins. If the batch would exceed the remaining limit, the entire batch is rejected (not partially processed)
- [ ] WebSocket/SSE streams (long-lived connections): rate limiting applies to the initial connection handshake, not to individual frames — `--rate-limit-stream-connections` limits concurrent stream connections per client (default: 5)
- [ ] Rate limit window boundary: sliding window avoids the "boundary burst" problem where a client sends the full limit at the end of one window and the start of the next
- [ ] Clock drift in distributed Redis: rate limit windows use Redis server time (`TIME` command), not application server time — prevents inconsistencies from clock skew
- [ ] Legitimate traffic spike (e.g., incident with many camera alerts): admin can temporarily adjust limits via `openeye ratelimit override --key incident-responder --limit 1000/minute --duration 1h` without restarting the server
- [ ] Bot detection: `--rate-limit-progressive` increases the `Retry-After` duration exponentially for clients that persistently hit rate limits (1s, 2s, 4s, 8s, ... up to 300s) — discourages automated abuse
- [ ] Rate limit counters for deleted API keys: counters are garbage-collected after 2x the window duration — no memory leak from key churn
- [ ] IPv6 rate limiting by prefix: `--rate-limit-ipv6-prefix 64` groups IPv6 addresses by /64 prefix to prevent evasion by rotating addresses within an allocation
- [ ] Rate limit header information leakage: `X-RateLimit-Limit` and `X-RateLimit-Remaining` reveal configured limits to attackers — consider making these headers optional (`--rate-limit-hide-headers`)
- [ ] Cost weighting manipulation: if `batch_size` is read from the request body, a malicious client could declare `batch_size: 1` but include 1000 images — cost weight should be calculated from actual payload
- [ ] Rate limiting bypass via HTTP/2 multiplexing: a single HTTP/2 connection can multiplex many requests — if rate limiting is per-connection rather than per-identity, HTTP/2 bypasses limits

### Technical Notes

- Rate limiting middleware lives in `server/middleware/ratelimit.py` with algorithm implementations in `server/middleware/ratelimit_algorithms.py`
- Sliding window uses a sorted set in Redis (`ZADD`/`ZRANGEBYSCORE`/`ZCARD`) or an in-memory deque per client
- Token bucket uses a simple counter with timestamp — more memory-efficient but less precise for bursty traffic
- Rate limit configuration schema is defined in `cli/openeye_ai/auth/ratelimit_config.py`
- Prometheus metrics use the `prometheus-client` library (already used for inference metrics)
- The `X-RateLimit-*` headers follow the IETF draft-ietf-httpapi-ratelimit-headers specification

### Example Config

```yaml
# limits.yaml
global:
  requests_per_minute: 100
  burst: 20
  algorithm: sliding-window

endpoints:
  "/predict":
    requests_per_minute: 30
    cost_weight: 1
  "/predict/batch":
    requests_per_minute: 10
    cost_weight_field: batch_size
  "/stream":
    connections_per_client: 5
  "/admin/*":
    requests_per_minute: 60

overrides:
  api_keys:
    admin-key:
      exempt: true
    monitoring-key:
      exempt: true
    heavy-user-key:
      requests_per_minute: 500

progressive_backoff:
  enabled: true
  max_retry_after: 300
```

---

## 115. Security Headers & OWASP Hardening

**As a security engineer, the OpenEye HTTP API implements OWASP security best practices so that the attack surface is minimized and the API is hardened against common web vulnerabilities.**

### Acceptance Criteria

- [ ] All HTTP responses include the following security headers by default:
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` (HSTS, when TLS is enabled)
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `X-XSS-Protection: 0` (disabled in favor of CSP, per OWASP recommendation)
  - `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'` (API-appropriate CSP)
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
  - `Cache-Control: no-store` (for API responses containing sensitive data)
- [ ] CORS is restrictive by default: `Access-Control-Allow-Origin` is not set unless explicitly configured via `--cors-origins https://dashboard.openeye.example.com` (see story 86)
- [ ] CORS credentials: `Access-Control-Allow-Credentials: true` is only sent when the origin is in the explicit allowlist — never with wildcard origin
- [ ] `Server` header is suppressed: the response does not reveal `uvicorn/0.x.x` or framework version information — configurable via `--server-header` to set a custom value
- [ ] Error responses never expose stack traces, internal paths, or dependency versions in production mode (`openeye serve --production`) — errors return `{"error": "<message>", "request_id": "<uuid>"}`
- [ ] Request ID (`X-Request-ID`) is generated for every request (UUID v4) and included in the response and all log entries for traceability — if the client sends an `X-Request-ID`, it is used (validated as UUID format)
- [ ] Request body size limits: `--max-body-size 20MB` (default) enforced at the middleware layer before parsing — returns `413 Payload Too Large`
- [ ] JSON request body validation: malformed JSON returns `400` with `{"error": "invalid_json"}` — no reflection of the malformed input in the error response (prevents XSS via error messages)
- [ ] `openeye security headers-test` makes a request to the running server and validates that all required security headers are present — reports missing or misconfigured headers
- [ ] HTTP method restriction: endpoints only accept their declared HTTP methods — unsupported methods return `405 Method Not Allowed` with an `Allow` header listing valid methods
- [ ] `openeye serve --production` enables all hardening features: security headers, error sanitization, audit logging, HSTS (if TLS), rate limiting defaults — a single flag for production readiness
- [ ] `openeye security audit` runs an automated security assessment against the OWASP API Security Top 10 (2023) and reports findings

### Edge Cases

- [ ] HSTS without TLS: if `openeye serve` runs without `--tls-cert`, the `Strict-Transport-Security` header is not sent — HSTS on HTTP would break the service. A `SECURITY_WARNING` is logged recommending TLS for production
- [ ] CORS preflight caching: `Access-Control-Max-Age: 7200` (2 hours) reduces preflight request volume — configurable via `--cors-max-age`
- [ ] Large `X-Request-ID` from client (>128 chars): truncated to 128 chars. Non-UUID values are accepted but logged with a warning — a server-generated UUID is used for internal tracking
- [ ] Path traversal in URL: requests with `..`, `%2e%2e`, or URL-encoded path traversal sequences are rejected with `400` before reaching route handlers — logged as a security event (see story 106)
- [ ] HTTP request smuggling: `Transfer-Encoding` and `Content-Length` headers are validated for consistency — conflicting values return `400`. The server only accepts `Transfer-Encoding: chunked` (no `identity`, `compress`, etc.)
- [ ] Slow HTTP attacks (Slowloris): `--request-timeout 30` (default) closes connections that don't send a complete request within the timeout. `--header-timeout 10` (default) closes connections that stall during header transmission
- [ ] Response body injection: all JSON responses are encoded with `ensure_ascii=True` to prevent Unicode-based injection attacks in downstream consumers
- [ ] Open redirect prevention: any redirect responses (3xx) only allow redirects to URLs on the same origin or explicitly configured allowed domains — external redirects are blocked and logged
- [ ] SSRF protection: if the API accepts URLs as input (e.g., `--input rtsp://...`), internal/private IP ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `127.0.0.0/8`, `169.254.0.0/16`) are blocked by default — configurable via `--allow-private-urls` for trusted environments
- [ ] Cookie security: if cookies are used (session management, story 113), they include `Secure`, `HttpOnly`, `SameSite=Strict`, and `__Host-` prefix attributes
- [ ] API versioning header: `X-API-Version: 1.0.0` is included in all responses — clients can use this to detect version mismatches
- [ ] HTTP/2 support: when TLS is enabled, HTTP/2 is negotiated via ALPN by default — `--http1-only` disables HTTP/2 if needed for compatibility
- [ ] SSRF via DNS rebinding: SSRF check validates IP at resolution time, but DNS rebinding uses short-TTL records that first resolve to a public IP then to internal IP — pin resolved IP and revalidate before connecting
- [ ] Host header injection: if server uses Host header to construct URLs (for OIDC redirect URIs, SAML entity IDs), an attacker can inject a malicious host — validate or explicitly configure expected host
- [ ] CORS misconfiguration with `null` origin: some browsers send `Origin: null` for sandboxed iframes — if accidentally added to CORS allowlist, any sandboxed page can make cross-origin requests
- [ ] Content-Type validation: API should reject requests with unexpected Content-Type headers to prevent content-type confusion attacks

### Technical Notes

- Security headers middleware lives in `server/middleware/security_headers.py` — applied to all responses via FastAPI middleware
- CORS is configured via FastAPI's `CORSMiddleware` with explicit origin validation
- Error sanitization middleware lives in `server/middleware/error_handler.py` — catches all exceptions and formats safe error responses in production mode
- Request ID middleware lives in `server/middleware/request_id.py` — propagates the ID via Python's `contextvars` for log correlation
- SSRF protection uses Python's `ipaddress` module to validate target IPs before establishing connections
- The `--production` flag sets: `OPENEYE_ENV=production`, enables security headers, enables error sanitization, enables audit logging (story 106), sets default rate limits (story 114), and disables debug endpoints (`/debug/*`)
- OWASP API Security Top 10 checks are implemented in `cli/openeye_ai/security/owasp_audit.py` — each risk category has a dedicated checker class
- Slowloris protection is handled at the uvicorn/hypercorn level via `--timeout-keep-alive` and `--timeout-notify` settings
