---
title: openeye run
---

Run inference on a single image and print JSON results.

```bash
openeye run yolov8 photo.jpg
openeye run depth-anything scene.png
openeye run grounding-dino image.jpg --prompt "red cup"
```

### Options

| Flag | Description |
|------|-------------|
| --prompt <text> | Text prompt for open-vocabulary models |
| --output <path> | Write results to a file instead of stdout |
| --pretty | Pretty-print JSON output |
