---
title: JavaScript / TypeScript
---

### Object Detection (fetch)

```typescript
const form = new FormData();
form.append("file", fileInput.files[0]);
form.append("confidence", "0.3");

const resp = await fetch("https://api.openeye.ai/v1/detect", {
  method: "POST",
  headers: { "X-API-Key": "oe_live_abc123" },
  body: form,
});

const data = await resp.json();
console.log(`Found ${data.objects.length} objects`);
data.objects.forEach((obj) => {
  console.log(`${obj.label}: ${(obj.confidence * 100).toFixed(1)}%`);
});
```

### Node.js (form-data)

```typescript
import fs from "fs";
import FormData from "form-data";

const form = new FormData();
form.append("file", fs.createReadStream("photo.jpg"));

const resp = await fetch("https://api.openeye.ai/v1/detect", {
  method: "POST",
  headers: {
    "X-API-Key": "oe_live_abc123",
    ...form.getHeaders(),
  },
  body: form,
});

const data = await resp.json();
console.log(data);
```

### WebSocket (Browser)

```typescript
const ws = new WebSocket("wss://api.openeye.ai/v1/stream");

ws.onopen = () => {
  ws.send(JSON.stringify({ api_key: "oe_live_abc123" }));
};

ws.onmessage = ({ data }) => {
  const msg = JSON.parse(data);
  if (msg.status === "authenticated") {
    console.log("Connected! Send frames now.");
  } else if (msg.objects) {
    console.log("Detections:", msg.objects);
  }
};
```
