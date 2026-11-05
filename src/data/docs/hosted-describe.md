---
title: POST /v1/describe
---

> [!warning] Scene description is being enabled on the hosted API. Until then this endpoint returns `503`; `GET /v1/models` shows `"available": true` once it's on.

Describe an image, or ask a question about it, with the Qwen2.5-VL vision-language model. Costs **3 credits** per call.

### Request

`multipart/form-data` with the image in `file` and an optional `prompt` (up to 2,000 characters; default "Describe what you see in this image.").

```bash
curl -X POST https://openeye.sh/v1/describe \
  -H "Authorization: Bearer oe_your_key_here" \
  -F "file=@scene.jpg" \
  -F "prompt=Is anyone standing near the robot arm?"
```

### Response

```json
{
  "model": "qwen/qwen2.5-vl-72b-instruct",
  "description": "A person is standing about a metre from the robot arm...",
  "image": { "width": 1280, "height": 720 },
  "inference_ms": 2140.5,
  "credits_used": 3
}
```
