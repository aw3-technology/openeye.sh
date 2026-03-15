---
title: openeye api
---

Client commands for the hosted inference API. Requires an API key (`OPENEYE_API_KEY` environment variable or `oe_...` format).

### Subcommands

| Command | Description |
|---------|-------------|
| api detect | Run object detection via hosted API |
| api depth | Run depth estimation via hosted API |
| api describe | Get VLM scene description |
| api models | List available models and credit costs |
| api usage | Show credit balance and usage stats |

### Examples

```bash
openeye api detect photo.jpg --pretty
openeye api detect photo.jpg --confidence 0.5
openeye api depth scene.png
openeye api describe photo.jpg --prompt "what hazards are present?"
openeye api models
openeye api usage --days 7
```

### Common Options

| Flag | Description |
|------|-------------|
| --server <url> | API server URL (default: $OPENEYE_API_URL) |
| --pretty | Pretty-print JSON output |
| --confidence <float> | Minimum confidence threshold (detect only) |
| --prompt <text> | Custom prompt (describe only) |
| --days <n> | Usage history period (usage only, default: 30) |
