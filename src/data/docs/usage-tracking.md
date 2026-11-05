---
title: Usage Tracking
---

### Hosted API

Every successful billed call to https://openeye.sh/v1 is logged with its endpoint, model, credits, and inference time. See it three ways:

- GET /v1/usage — balance, totals, per-endpoint counts, and credits per day (see GET /v1/usage)
- openeye api usage --days 7 — the same from the CLI
- Dashboard → Settings → Credits — balance and purchases; Settings → API Keys shows when each key was last used

### Server Logs

When running `openeye serve`, the server logs each inference request with timing information to stdout.

### Health Endpoint

Check server status:

```bash
curl http://localhost:8000/health
openeye health
```

### Metrics

GET /metrics on the self-hosted server exposes Prometheus counters and histograms for request counts and latency. The dashboard's Metrics page reads it once connected to your server.

### CLI Benchmarks

Use `openeye bench` to measure inference performance:

```bash
openeye bench yolov8 --runs 20 --warmup 5
```

Reports mean, median, and p95 latency with FPS.
