---
title: openeye fleet
---

Client for a self-hosted fleet control plane (see Fleet Authentication for setting one up), plus the device agent that runs on each edge device.

```bash
export OPENEYE_FLEET_URL=http://localhost:8001   # default
export OPENEYE_TOKEN=<better-auth-session-token>
openeye fleet ls
```

Every command except fleet agent sends OPENEYE_TOKEN as a Bearer token and exits with an error if it isn't set. The fleet routes accept only a Better Auth session token (oe_ API keys work only on /v1), and the session must exist in the control plane's database — see Fleet Authentication.

### Devices

| Command | Description |
|---------|-------------|
| fleet register NAME [--type, -t] | Register a device (camera, robot, edge_node, gateway, drone; default edge_node). Prints the device's oek_ key once |
| fleet ls [--status, -s] [--type, -t] | List devices; filter by status (online, offline, error) or type |
| fleet info DEVICE_ID | Show device details |
| fleet tag DEVICE_ID TAGS | Set tags (key=value pairs) |
| fleet config DEVICE_ID CONFIG_JSON | Set config overrides |
| fleet resources DEVICE_ID [--limit, -n] | Resource usage history (default 20 points) |
| fleet restart DEVICE_ID | Queue a restart command |
| fleet decommission DEVICE_ID [--reason, -r] [--wipe] | Decommission a device |
| fleet batch COMMAND [--tag, -t key=value] [--payload, -p JSON] | Send a command to every device matching a tag |
| fleet commands [--device, -d] [--status, -s] | List pending device commands |

### Deployments and OTA

| Command | Description |
|---------|-------------|
| fleet deploy --model, -m ID --version, -v VER [--name, -n] [--strategy] [--group, -g] [--url] | Create a staged deployment. Strategy: canary (default), rolling, blue_green, all_at_once |
| fleet deployments [--status, -s] | List deployments (pending, in_progress, completed, failed, rolled_back) |
| fleet advance DEPLOYMENT_ID | Advance a canary to its next stage |
| fleet pause-deployment DEPLOYMENT_ID | Pause a running deployment |
| fleet rollback DEPLOYMENT_ID | Roll back to the previous model version |
| fleet ota --url, -u URL --version, -v VER [--group, -g] [--devices, -d IDS] [--force] | Push a firmware/software update |

### Groups and Maintenance

| Command | Description |
|---------|-------------|
| fleet group-create NAME [--desc, -d] | Create a device group |
| fleet groups | List groups |
| fleet group-add GROUP_ID DEVICE_ID | Add a device to a group |
| fleet group-remove GROUP_ID DEVICE_ID | Remove a device from a group |
| fleet group-members GROUP_ID | List a group's devices |
| fleet group-scaling GROUP_ID [--enabled/--disabled] [--min 1] [--max 10] [--target-cpu 70] | Set an auto-scaling policy |
| fleet maintenance-create --name, -n --start ISO --end ISO [--devices, -d] [--group, -g] | Create a maintenance window |
| fleet maintenance-list [--active] | List windows |
| fleet maintenance-update WINDOW_ID [--name] [--start] [--end] | Update a window |
| fleet maintenance-delete WINDOW_ID | Delete a window |

### Alerts

| Command | Description |
|---------|-------------|
| fleet alerts [--resolved true/false] | List alerts |
| fleet resolve-alert ALERT_ID | Resolve an alert |

### Device Agent

Run this on the edge device itself. It authenticates with the device's oek_ key (sent as X-Device-API-Key), sends heartbeats, and executes queued commands.

```bash
openeye fleet agent --device-id <uuid> --api-key oek_... --server http://control-plane:8001
```

| Flag | Default | Description |
|------|---------|-------------|
| --device-id, -d | — | Device UUID (required) |
| --api-key, -k | $OPENEYE_DEVICE_API_KEY | Device key from registration (required) |
| --server, -s | $OPENEYE_FLEET_URL or http://localhost:8001 | Control plane URL |
| --interval | 15.0 | Heartbeat interval in seconds |
