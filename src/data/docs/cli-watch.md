---
title: openeye watch
---

Live camera feed with real-time detections displayed in the terminal using Rich.

```bash
openeye watch --models yolov8
openeye watch --models yolov8,depth-anything
openeye watch --models yolov8 --safety
openeye watch --models yolov8 --video demo.mp4
openeye watch --models yolov8 --demo
```

### Options

| Flag | Description |
|------|-------------|
| --models, -m <names> | Comma-separated model names (default: yolov8) |
| --camera, -c <index> | Camera index (default: 0) |
| --video, -v <path> | Video file path (fallback if camera fails) |
| --safety, -s | Enable Safety Guardian with zone-based human detection |
| --danger-m <metres> | Danger zone threshold (default: 0.5, requires --safety) |
| --caution-m <metres> | Caution zone threshold (default: 1.5, requires --safety) |
| --demo | Warm up models before starting for zero cold-start |

### Safety Guardian

With `--safety`, the terminal overlay shows color-coded proximity zones around detected humans:

- **SAFE** (green) — human is beyond caution threshold
- **CAUTION** (yellow) — human within caution zone
- **DANGER** (red) — human within danger zone, halt recommended

```bash
openeye watch --models yolov8 --safety --danger-m 0.5 --caution-m 1.5
```
