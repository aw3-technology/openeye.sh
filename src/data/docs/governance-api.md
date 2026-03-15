---
title: Governance API
---

The governance API provides endpoints for managing safety policies, presets, and audit logs. All endpoints are prefixed with `/governance`. The governance engine is optional — endpoints return 503 if it is not initialized.

### GET /governance/status

Returns the current status of the governance engine.

```json
{
  "active": true,
  "config_name": "robotics-standard",
  "domain": "robotics",
  "total_policies": 6,
  "enabled_policies": 4,
  "total_evaluations": 1280,
  "total_violations": 3,
  "total_warnings": 12,
  "fail_open": false
}
```

### GET /governance/policies

List all currently active (enabled) policies.

```json
[
  {
    "name": "zone_boundary",
    "type": "ZoneBoundaryPolicy",
    "domain": "robotics",
    "description": "Enforces spatial boundary constraints",
    "enabled": true,
    "severity": "critical",
    "enforcement": "enforce",
    "is_plugin": false
  }
]
```

### GET /governance/policies/available

List all registered policy types that can be enabled, including built-in and plugin policies.

```json
[
  {
    "name": "pii_filter",
    "type": "PIIFilterPolicy",
    "domain": "universal",
    "description": "Redacts personally identifiable information from observations",
    "enabled": false,
    "severity": "high",
    "enforcement": "enforce",
    "is_plugin": false
  }
]
```

### POST /governance/policies/{name}/enable

Enable a policy by name. Returns 404 if the policy type is not registered.

**Response:**
```json
{"status": "enabled", "name": "zone_boundary"}
```

### POST /governance/policies/{name}/disable

Disable a policy by name. Returns 404 if the policy is not currently active.

**Response:**
```json
{"status": "disabled", "name": "zone_boundary"}
```

### GET /governance/presets

List available governance presets (pre-configured policy bundles).

```json
["robotics-standard", "robotics-strict", "desktop-agent", "permissive"]
```

### POST /governance/presets/{name}/load

Load a governance preset by name, replacing the current policy configuration. Returns 404 if the preset is not found.

**Response:**
```json
{"status": "loaded", "preset": "robotics-standard"}
```

### GET /governance/config

Get the current governance configuration as YAML.

```json
{"yaml": "domain: robotics\nfail_open: false\npolicies:\n  - name: zone_boundary\n    ..."}
```

### PUT /governance/config

Update the governance configuration. Validates the YAML before applying.

**Request body:**
```json
{"yaml": "domain: robotics\nfail_open: false\npolicies:\n  - name: zone_boundary\n    type: ZoneBoundaryPolicy\n    severity: critical\n    enforcement: enforce\n    config:\n      zones:\n        - name: workspace\n          bounds: [0.0, 0.0, 1.0, 1.0]"}
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
| limit | int | 100 | Maximum entries to return |
| offset | int | 0 | Pagination offset |

```json
[
  {
    "timestamp": 1710504000.0,
    "frame_id": 42,
    "policy_name": "zone_boundary",
    "decision": "deny",
    "reason": "Object 'person' detected outside permitted zone 'workspace'",
    "severity": "critical",
    "affected_objects": ["person_0"],
    "metadata": {}
  }
]
```

### GET /governance/violations

Get audit entries filtered to policy violations (deny and warn decisions only).

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| limit | int | 50 | Maximum entries to return |

Response format is identical to the audit endpoint above.
