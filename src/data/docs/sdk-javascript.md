---
title: JavaScript / TypeScript
---

### Object Detection (hosted API, Node 18+)

Keep the API key on a server; don't ship it to browsers.

```typescript
import { readFile } from "node:fs/promises";

const form = new FormData();
form.append("file", new Blob([await readFile("photo.jpg")], { type: "image/jpeg" }), "photo.jpg");
form.append("confidence", "0.3");

const resp = await fetch("https://openeye.sh/v1/detect", {
  method: "POST",
  headers: { Authorization: `Bearer ${process.env.OPENEYE_API_KEY}` },
  body: form,
});
if (!resp.ok) throw new Error(`${resp.status}: ${(await resp.json()).error}`);

const data = await resp.json();
console.log(`${data.objects.length} objects, ${data.credits_used} credit(s)`);
```

### Object Detection (self-hosted, fetch)

```typescript
const form = new FormData();
form.append("file", fileInput.files[0]);

const resp = await fetch("http://localhost:8000/predict", {
  method: "POST",
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

const resp = await fetch("http://localhost:8000/predict", {
  method: "POST",
  headers: form.getHeaders(),
  body: form,
});

const data = await resp.json();
console.log(data);
```

### WebSocket (Browser)

```typescript
const ws = new WebSocket("ws://localhost:8000/ws");

ws.onopen = () => {
  console.log("Connected! Send base64-encoded frames.");
};

ws.onmessage = ({ data }) => {
  const msg = JSON.parse(data);
  if (msg.objects) {
    console.log("Detections:", msg.objects);
  }
};
```
