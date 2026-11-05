---
title: openeye api
---

Client commands for the hosted inference API at https://openeye.sh/v1. They need an API key from the dashboard (Settings → API Keys) in the OPENEYE_API_KEY environment variable; the CLI sends it as Authorization: Bearer. No models need to be downloaded.

```bash
export OPENEYE_API_KEY=oe_your_key_here
```

### Subcommands

| Command | Description | Hosted status |
|---------|-------------|---------------|
| api detect IMAGE | Object detection (1 credit) | Live |
| api describe IMAGE | VLM scene description (3 credits) | 503 until enabled |
| api depth IMAGE | Depth estimation (2 credits) | 501, self-hosted only |
| api models | List hosted models and credit costs | Live |
| api usage | Show credit balance and usage stats | Live |

### Examples

```bash
openeye api detect photo.jpg
openeye api detect photo.jpg --confidence 0.5
openeye api detect photo.jpg --pretty
openeye api describe photo.jpg --prompt "what hazards are present?"
openeye api models
openeye api usage --days 7
```

openeye api detect prints the number of objects and credits used, then one line per object (label and confidence). With --pretty it prints the full JSON response instead.

### Options

| Command | Flag | Default | Description |
|---------|------|---------|-------------|
| detect | --confidence, -c <float> | 0.25 | Minimum confidence (0–1) |
| detect | --pretty, -p | off | Print the full JSON response |
| describe | --prompt, -p <text> | Describe what you see in this image. | Prompt for the VLM |
| usage | --days, -d <n> | 30 | Usage history window in days |
| all | --server, -s <url> | $OPENEYE_API_URL or https://openeye.sh | API base URL (/v1 is appended) |

Note that -p means --pretty on detect but --prompt on describe.

### Errors

HTTP errors are printed as Error <status>: <body> and the command exits with code 1. Common ones: 401 (bad or missing key), 402 (not enough credits — buy more in Settings → Credits), 429 (rate limit; wait and retry). If OPENEYE_API_KEY isn't set, the command exits before sending anything.

### Against a local server

Point the commands at openeye serve with --server http://localhost:8000 (or OPENEYE_API_URL). Any oe_ key works there unless the server sets OPENEYE_SERVER_API_KEY. The local server reads confidence and prompt only from the query string, so --confidence and --prompt currently have no effect against it.
