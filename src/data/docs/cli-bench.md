---
title: openeye bench
---

Benchmark a model's inference speed. Reports mean, median, and P95 latency with FPS.

```bash
openeye bench yolov8
openeye bench yolov8 --runs 50
openeye bench yolov8 --variant onnx --width 1280 --height 720
```

### Options

| Flag | Description |
|------|-------------|
| --variant <name> | Variant to benchmark |
| --warmup <n> | Number of warmup runs (default: 3) |
| --runs <n> | Number of timed runs (default: 10) |
| --width <px> | Test image width (default: 640) |
| --height <px> | Test image height (default: 480) |

### Example Output

```
    Benchmark: YOLOv8
┏━━━━━━━━━━━━┳━━━━━━━━━━┓
┃ Metric     ┃    Value ┃
┡━━━━━━━━━━━━╇━━━━━━━━━━┩
│ Mean       │ 50.49 ms │
│ Median     │ 49.96 ms │
│ P95        │ 53.64 ms │
│ FPS        │     19.8 │
│ Runs       │        5 │
│ Image Size │  640x480 │
└────────────┴──────────┘
```
