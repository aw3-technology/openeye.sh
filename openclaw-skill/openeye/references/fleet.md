# Fleet Management Reference

## Device Lifecycle

```bash
# Register a new device
openeye fleet register --name "warehouse-cam-01" --type camera

# List devices
openeye fleet ls                          # all devices
openeye fleet ls --status online          # filter by status
openeye fleet ls --type camera            # filter by type

# Device details
openeye fleet info <device-id>

# Tag devices for grouping
openeye fleet tag <device-id> site=warehouse role=entrance

# Device groups
openeye fleet group-create warehouse-cameras --desc "All warehouse camera nodes"

# Configure device
openeye fleet config <device-id> '{"model": "yolov8", "danger_zone_m": 0.5, "confidence_threshold": 0.7}'

# Restart / decommission
openeye fleet restart <device-id>
openeye fleet decommission <device-id>
```

## Deployments

Deploy model updates to fleets with staged rollout strategies.

```bash
# Create deployment
openeye fleet deploy \
  --name "yolov8-v2-rollout" \
  --model yolov8 \
  --version v2.1.0 \
  --strategy canary \
  --group warehouse-cameras

# Monitor
openeye fleet deployments                     # list all
openeye fleet deployments --status in_progress

# Rollback
openeye fleet rollback <deployment-id>
```

### Strategies

| Strategy | Behavior |
|----------|----------|
| `canary` | Deploy to small subset first, promote on success |
| `rolling` | Gradual rollout across devices |
| `blue-green` | Run old and new in parallel, switch on validation |
| `all_at_once` | Deploy to all devices simultaneously |

## Device Communication

- Heartbeat-based health monitoring
- MQTT over TLS for commands and telemetry
- REST API for management operations
- Metrics stored in TimescaleDB for time-series analysis

## Provisioning

Token-based device enrollment:
1. Generate provisioning token from control plane
2. Device runs enrollment with token
3. Device receives config and begins reporting
