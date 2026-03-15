---
title: Usage Tracking
---

### Server Logs

When running `openeye serve`, the server logs each inference request with timing information to stdout.

### Health Endpoint

Check server status:

```bash
curl http://localhost:8000/health
```

### CLI Benchmarks

Use `openeye bench` to measure inference performance:

```bash
openeye bench yolov8 --runs 20 --warmup 5
```

Reports mean, median, and p95 latency with FPS.
