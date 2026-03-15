---
title: Fleet Authentication
---

### Device API Keys

Edge devices authenticate with device-specific API keys generated at registration via `openeye fleet register`. These keys are sent in the `X-Device-API-Key` header for heartbeat and command completion endpoints.

### JWT Authentication

Fleet management REST endpoints (devices, deployments, groups, maintenance, alerts) require a JWT token in the `Authorization: Bearer <jwt>` header.

### CLI Authentication

Fleet management commands via the CLI use your local configuration. No separate authentication is required for CLI-based fleet operations.
