---
title: Governance API
---

The governance API provides endpoints for managing safety policies, presets, and audit logs. All endpoints are prefixed with `/governance` and are served by `openeye serve`. The routes and engine come from the backend's `governance` package, so they are only mounted when the server runs from a repo checkout (the openeye-sh wheel doesn't include it); endpoints return 503 if the engine is not initialized.

### GET /governance/status

Returns the current status of the governance engine.

```json
{
  "active": true,
  "config_name": "robotics",
  "domain": "robotics",
  "total_policies": 5,
  "enabled_policies": 4,
  "enabled_policy_names": ["dangerous_objects", "human-detection-blur", "workspace_boundaries", "action_rate"],
  "total_evaluations": 1280,
  "total_violations": 3,
  "total_warnings": 12,
  "fail_open": false
}
```

### GET /governance/policies

List all policies in the loaded configuration, enabled or not.

```json
[
  {
    "name": "workspace_boundaries",
    "type": "zone_policy",
    "domain": "universal",
    "description": "",
    "enabled": true,
    "severity": "critical",
    "enforcement": "enforce",
    "is_plugin": false
  }
]
```

### GET /governance/policies/available

List all registered policy types, built-in and plugin. Built-in types: zone_policy, object_restriction, action_filter, pii_filter, interaction_boundary, rate_limiter. `name` and `type` are both the type name; `enabled`, `severity`, and `enforcement` are defaults, not live state.

```json
[
  {
    "name": "pii_filter",
    "type": "pii_filter",
    "domain": "desktop_agent",
    "description": "Detect and redact PII (email, phone, SSN, credit card) in screen text.",
    "enabled": false,
    "severity": "medium",
    "enforcement": "enforce",
    "is_plugin": false
  }
]
```

### POST /governance/policies/{name}/enable

Enable a policy from the loaded configuration by its name. Returns 404 if no policy with that name is configured.

**Response:**
```json
{"status": "enabled", "name": "workspace_boundaries"}
```

### POST /governance/policies/{name}/disable

Disable a policy by name (its config is kept). Returns 404 if no policy with that name is configured.

**Response:**
```json
{"status": "disabled", "name": "workspace_boundaries"}
```

### GET /governance/presets

List available governance presets (pre-configured policy bundles).

```json
["desktop_privacy", "desktop_restricted", "minimal", "robotics", "robotics_safety", "robotics_warehouse"]
```

### POST /governance/presets/{name}/load

Load a governance preset by name, replacing the current policy configuration. Returns 404 if the preset is not found, 422 if the name has characters other than letters, digits, `_`, and `-`.

**Response:**
```json
{"status": "loaded", "preset": "robotics"}
```

### GET /governance/config

Get the current governance configuration as YAML.

```json
{"yaml": "version: '1.0'\nname: robotics\ndomain: robotics\nextends: []\npolicies:\n- name: workspace_boundaries\n  type: zone_policy\n  ...\nsettings:\n  log_all_decisions: true\n  fail_open: false\n  evaluation_timeout_ms: 50\n"}
```

### PUT /governance/config

Update the governance configuration. Validates the YAML before applying.

**Request body:**
```json
{"yaml": "name: custom\ndomain: robotics\npolicies:\n  - name: workspace_boundaries\n    type: zone_policy\n    severity: critical\n    enforcement: enforce\n    config:\n      zones:\n        - name: danger_zone\n          level: danger\n          shape: circle\n          center: [0, 0, 0]\n          radius_m: 0.5\n          on_violation: halt\nsettings:\n  fail_open: false"}
```

**Response:**
```json
{"status": "updated"}
```

Returns 400 if the YAML is invalid or contains unknown policy types.

### GET /governance/audit

Get audit log entries.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| limit | int | 100 | Maximum entries to return (1–1000) |
| offset | int | 0 | Pagination offset |

```json
[
  {
    "timestamp": 1710504000.0,
    "frame_id": 42,
    "policy_name": "workspace_boundaries",
    "decision": "deny",
    "reason": "Object 'person' (track person_0) inside danger zone 'danger_zone'",
    "severity": "critical",
    "affected_objects": ["person_0"],
    "metadata": {}
  }
]
```

### GET /governance/violations

Get the most recent audit entries with a deny decision (newest first). Decisions in the audit log are allow, deny, modify, warn, or audit_only.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| limit | int | 50 | Maximum entries to return |

Response format is identical to the audit endpoint above.
