/**
 * YOLOv8n object detection on CPU via onnxruntime-web (WebAssembly), so it
 * runs inside a Vercel function without native binaries or PyTorch.
 * Output matches backend/src/fleet/services/inference_service.py `detect`.
 */
import path from "node:path";
import * as ort from "onnxruntime-web";
import jpeg from "jpeg-js";
import { PNG } from "pngjs";
import { HttpError } from "./http.js";

const INPUT_SIZE = 640;
const IOU_THRESHOLD = 0.45;
const MAX_DETECTIONS = 300;
// Decoding is pure JS; very large photos would be slow and memory-hungry.
const MAX_PIXELS = 25_000_000;

const COCO_CLASSES = [
  "person", "bicycle", "car", "motorcycle", "airplane", "bus", "train", "truck", "boat", "traffic light",
  "fire hydrant", "stop sign", "parking meter", "bench", "bird", "cat", "dog", "horse", "sheep", "cow",
  "elephant", "bear", "zebra", "giraffe", "backpack", "umbrella", "handbag", "tie", "suitcase", "frisbee",
  "skis", "snowboard", "sports ball", "kite", "baseball bat", "baseball glove", "skateboard", "surfboard",
  "tennis racket", "bottle", "wine glass", "cup", "fork", "knife", "spoon", "bowl", "banana", "apple",
  "sandwich", "orange", "broccoli", "carrot", "hot dog", "pizza", "donut", "cake", "chair", "couch",
  "potted plant", "bed", "dining table", "toilet", "tv", "laptop", "mouse", "remote", "keyboard", "cell phone",
  "microwave", "oven", "toaster", "sink", "refrigerator", "book", "clock", "vase", "scissors", "teddy bear",
  "hair drier", "toothbrush",
];

export interface DecodedImage {
  width: number;
  height: number;
  /** RGBA, 4 bytes per pixel. */
  data: Uint8Array;
}

export interface Detection {
  label: string;
  confidence: number;
  bbox: { x: number; y: number; w: number; h: number };
}

/** Decodes JPEG or PNG bytes (detected by signature) to RGBA. */
export function decodeImage(bytes: Buffer): DecodedImage {
  const isPng = bytes.length > 8 && bytes.readUInt32BE(0) === 0x89504e47;
  const isJpeg = bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8;
  try {
    if (isPng) {
      const png = PNG.sync.read(bytes);
      if (png.width * png.height > MAX_PIXELS) throw new HttpError(413, "Image is too large (max 25 megapixels)");
      return { width: png.width, height: png.height, data: png.data };
    }
    if (isJpeg) {
      const img = jpeg.decode(bytes, {
        useTArray: true,
        formatAsRGBA: true,
        maxResolutionInMP: MAX_PIXELS / 1_000_000,
        maxMemoryUsageInMB: 512,
      });
      return { width: img.width, height: img.height, data: img.data };
    }
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(400, "Could not decode the image");
  }
  throw new HttpError(415, "Image must be JPEG or PNG");
}

let sessionPromise: Promise<ort.InferenceSession> | null = null;

function getSession() {
  if (!sessionPromise) {
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.wasmPaths = path.join(process.cwd(), "node_modules/onnxruntime-web/dist/");
    sessionPromise = ort.InferenceSession.create(path.join(process.cwd(), "models/yolov8n.onnx"), {
      executionProviders: ["wasm"],
    });
    sessionPromise.catch(() => {
      sessionPromise = null;
    });
  }
  return sessionPromise;
}

/** Letterboxes the image into a 640x640 CHW float tensor (grey padding, as Ultralytics does). */
function preprocess(img: DecodedImage) {
  const scale = Math.min(INPUT_SIZE / img.width, INPUT_SIZE / img.height);
  const nw = Math.round(img.width * scale);
  const nh = Math.round(img.height * scale);
  const dx = Math.floor((INPUT_SIZE - nw) / 2);
  const dy = Math.floor((INPUT_SIZE - nh) / 2);
  const plane = INPUT_SIZE * INPUT_SIZE;
  const tensor = new Float32Array(3 * plane).fill(114 / 255);

  for (let y = 0; y < nh; y++) {
    const sy = Math.min(img.height - 1, (y + 0.5) / scale - 0.5);
    const y0 = Math.max(0, Math.floor(sy));
    const y1 = Math.min(img.height - 1, y0 + 1);
    const fy = Math.max(0, sy - y0);
    for (let x = 0; x < nw; x++) {
      const sx = Math.min(img.width - 1, (x + 0.5) / scale - 0.5);
      const x0 = Math.max(0, Math.floor(sx));
      const x1 = Math.min(img.width - 1, x0 + 1);
      const fx = Math.max(0, sx - x0);
      const out = (y + dy) * INPUT_SIZE + (x + dx);
      for (let c = 0; c < 3; c++) {
        const p00 = img.data[(y0 * img.width + x0) * 4 + c];
        const p01 = img.data[(y0 * img.width + x1) * 4 + c];
        const p10 = img.data[(y1 * img.width + x0) * 4 + c];
        const p11 = img.data[(y1 * img.width + x1) * 4 + c];
        const top = p00 + (p01 - p00) * fx;
        const bottom = p10 + (p11 - p10) * fx;
        tensor[c * plane + out] = (top + (bottom - top) * fy) / 255;
      }
    }
  }
  return { tensor, scale, dx, dy };
}

function iou(a: number[], b: number[]) {
  const ix = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0]));
  const iy = Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
  const inter = ix * iy;
  const union = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter;
  return union > 0 ? inter / union : 0;
}

const round4 = (v: number) => Math.round(v * 10_000) / 10_000;

export async function detect(img: DecodedImage, confidence: number): Promise<{ objects: Detection[]; inferenceMs: number }> {
  const session = await getSession();
  const { tensor, scale, dx, dy } = preprocess(img);
  const start = performance.now();
  const output = await session.run({
    [session.inputNames[0]]: new ort.Tensor("float32", tensor, [1, 3, INPUT_SIZE, INPUT_SIZE]),
  });
  const inferenceMs = performance.now() - start;

  // Output is [1, 4 + classes, anchors]: cx, cy, w, h then one score per class.
  const out = output[session.outputNames[0]];
  const [, rowsCount, anchors] = out.dims as number[];
  const data = out.data as Float32Array;
  const classCount = rowsCount - 4;

  const candidates: { box: number[]; score: number; cls: number }[] = [];
  for (let i = 0; i < anchors; i++) {
    let best = 0;
    let cls = 0;
    for (let c = 0; c < classCount; c++) {
      const s = data[(4 + c) * anchors + i];
      if (s > best) {
        best = s;
        cls = c;
      }
    }
    if (best < confidence) continue;
    const cx = data[i], cy = data[anchors + i], w = data[2 * anchors + i], h = data[3 * anchors + i];
    // Undo the letterbox to get original-image pixel coordinates.
    const box = [
      Math.max(0, (cx - w / 2 - dx) / scale),
      Math.max(0, (cy - h / 2 - dy) / scale),
      Math.min(img.width, (cx + w / 2 - dx) / scale),
      Math.min(img.height, (cy + h / 2 - dy) / scale),
    ];
    candidates.push({ box, score: best, cls });
  }

  candidates.sort((a, b) => b.score - a.score);
  const kept: typeof candidates = [];
  for (const cand of candidates) {
    if (kept.length >= MAX_DETECTIONS) break;
    if (kept.every((k) => k.cls !== cand.cls || iou(k.box, cand.box) < IOU_THRESHOLD)) kept.push(cand);
  }

  const objects = kept.map(({ box, score, cls }) => ({
    label: COCO_CLASSES[cls] ?? String(cls),
    confidence: round4(score),
    bbox: {
      x: round4(box[0] / img.width),
      y: round4(box[1] / img.height),
      w: round4((box[2] - box[0]) / img.width),
      h: round4((box[3] - box[1]) / img.height),
    },
  }));
  return { objects, inferenceMs };
}
