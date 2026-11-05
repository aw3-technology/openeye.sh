---
title: POST /v1/describe
---

> [!warning] Scene description is not switched on for the hosted API yet. Until it is, POST https://openeye.sh/v1/describe returns 503 and charges nothing. GET /v1/models shows the qwen2.5-vl entry with "available": true once it's on.

Describe an image, or ask a question about it, with the Qwen2.5-VL vision-language model (qwen/qwen2.5-vl-72b-instruct, via OpenRouter). Costs 3 credits per call.

### Request

`multipart/form-data` with the image in `file` (JPEG or PNG, under 4 MB) and an optional `prompt` form field (up to 2,000 characters; default "Describe what you see in this image."). Answers are capped at 512 tokens.

```bash
curl -X POST https://openeye.sh/v1/describe \
  -H "Authorization: Bearer oe_your_key_here" \
  -F "file=@scene.jpg" \
  -F "prompt=Is anyone standing near the robot arm?"
```

From the CLI:

```bash
openeye api describe scene.jpg --prompt "Is anyone standing near the robot arm?"
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

`inference_ms` here is the round trip to the vision model, so expect seconds rather than milliseconds.

### Errors

| Status | Meaning |
|--------|---------|
| 400 | Missing `file`, prompt over 2,000 characters, or an image that can't be decoded |
| 401 | Missing or invalid API key |
| 402 | Not enough credits |
| 413 | Image over 4 MB, or a PNG over 25 megapixels |
| 415 | Not JPEG or PNG, or the request is not multipart/form-data |
| 429 | Rate limit exceeded |
| 502 | The vision model request failed (credits are refunded) |
| 503 | Scene description isn't enabled on the hosted API yet |

### Self-hosted alternatives

Run VLMs on your own server with OPENROUTER_API_KEY or NEBIUS_API_KEY set: POST /vlm/analyze for single images, or the /ws/vlm WebSocket for streams (see VLM via OpenRouter and WebSocket).
