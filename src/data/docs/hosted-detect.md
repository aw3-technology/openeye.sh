---
title: POST /v1/detect
---

Object detection with YOLOv8 Nano (80 COCO classes), run on CPU with ONNX Runtime. Costs 1 credit per call.

### Request

`multipart/form-data` with the image in a field named `file` (JPEG or PNG, under 4 MB). `confidence` (0–1, default `0.25`) can be a form field or a query parameter.

```bash
curl -X POST https://openeye.sh/v1/detect \
  -H "Authorization: Bearer oe_your_key_here" \
  -F "file=@photo.jpg" \
  -F "confidence=0.3"
```

```python
import requests

resp = requests.post(
    "https://openeye.sh/v1/detect",
    headers={"Authorization": "Bearer oe_your_key_here"},
    files={"file": open("photo.jpg", "rb")},
    data={"confidence": 0.3},
)
for obj in resp.json()["objects"]:
    print(obj["label"], obj["confidence"])
```

### Response

```json
{
  "model": "yolov8",
  "objects": [
    {
      "label": "person",
      "confidence": 0.9512,
      "bbox": { "x": 0.1234, "y": 0.2345, "w": 0.3456, "h": 0.4567 }
    }
  ],
  "image": { "width": 1920, "height": 1080 },
  "inference_ms": 14.23,
  "credits_used": 1
}
```

`bbox` values are normalized to the image size: `x`, `y` are the top-left corner and `w`, `h` the box size, all between 0 and 1.

### Errors

| Status | Meaning |
|--------|---------|
| 400 | Missing `file`, bad `confidence`, or an image that can't be decoded |
| 401 | Missing or invalid API key |
| 402 | Not enough credits |
| 413 | Image over 4 MB, or a PNG over 25 megapixels |
| 415 | Not JPEG or PNG, or the request is not multipart/form-data |
| 429 | Rate limit exceeded (see Rate Limits) |

Error bodies are JSON with an `error` message, e.g. `{"error": "Image must be under 4 MB"}`. Credits are taken only after the image is decoded, and refunded if inference fails.

### From the CLI

```bash
export OPENEYE_API_KEY=oe_your_key_here
openeye api detect photo.jpg --confidence 0.3
openeye api detect photo.jpg --pretty   # full JSON response
```

### Self-hosted

`openeye serve yolov8` serves the same route at `http://localhost:8000/v1/detect`, free. There `confidence` must be a query parameter (`/v1/detect?confidence=0.3`).
