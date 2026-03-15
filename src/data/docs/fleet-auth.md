---
title: Fleet Authentication
---

### Device API Keys

Edge devices authenticate with device-specific API keys generated at registration via `openeye fleet register`. These keys are used in the heartbeat protocol.

### CLI Authentication

Fleet management commands via the CLI use your local configuration. No separate authentication is required for CLI-based fleet operations.

> [!warning] REST API endpoints for fleet management with JWT authentication are planned but not yet available as a hosted service. Use the CLI for fleet operations today.
