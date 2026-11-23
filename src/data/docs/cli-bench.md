---
title: openeye bench
---

Benchmark a model's inference speed. Reports mean, median, standard deviation, min, max, and P95 latency with FPS, plus the hardware it ran on.

```bash
openeye bench yolov8
openeye bench yolov8 --runs 50
openeye bench yolov8 --variant quantized --width 1280 --height 720
```

### Options

| Flag | Description |
|------|-------------|
| --variant <name> | Variant to benchmark (must be pulled first, e.g. quantized for yolov8) |
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
│ Std Dev    │  1.52 ms │
│ Min        │ 48.71 ms │
│ Max        │ 54.10 ms │
│ P95        │ 53.64 ms │
│ FPS        │     19.8 │
├────────────┼──────────┤
│ Runs       │       10 │
│ Warmup     │        3 │
│ Image Size │  640x480 │
├────────────┼──────────┤
│ Device     │      cpu │
│ ...        │          │
└────────────┴──────────┘
```
