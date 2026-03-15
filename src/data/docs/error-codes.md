---
title: Error Codes
---

All API errors return a consistent JSON body with `error`, `message`, and `status_code` fields.

```json
{
  "error": "invalid_image",
  "message": "Cannot decode the uploaded file.",
  "status_code": 400
}
```

### Self-Hosted Server Error Codes

| Status | Error | Description |
|--------|-------|-------------|
| 400 | bad_request | Invalid parameters or cannot decode image |
| 413 | payload_too_large | Image exceeds the 20 MB limit |
| 500 | internal_error | Unexpected server error |
| 503 | model_unavailable | Model is loading or temporarily unavailable |
