export interface TerminalLine {
  text: string;
  color: "green" | "muted" | "default" | "amber";
}

export interface Command {
  label: string;
  command: string;
  description: string;
}

export interface ValueProp {
  label: string;
  description: string;
}

export const planTerminalLines: TerminalLine[] = [
  { text: "$ openeye watch --safety", color: "green" },
  { text: "", color: "default" },
  { text: "[TICK 1] Perceiving...", color: "muted" },
  { text: "[DETECT] 3 objects: cup_01, book_01, knife_01", color: "green" },
  { text: "[SCENE] workspace clear, 1 hazard flagged", color: "green" },
  { text: "", color: "default" },
  { text: "[TICK 2] Reasoning...", color: "muted" },
  { text: "[VLM] knife_01 near edge — fall risk detected", color: "amber" },
  { text: "[PLAN] Move knife_01 → safe_zone_b", color: "green" },
  { text: "", color: "default" },
  { text: "[TICK 3] Acting...", color: "muted" },
  { text: "[EXEC] Sent action to robot adapter", color: "amber" },
  { text: "[DONE] Hazard resolved. Monitoring resumed.", color: "green" },
];

export const commands: Command[] = [
  { label: "Run", command: "openeye run yolov8 image.jpg", description: "Run inference on any image with any model. Returns unified JSON with objects, depth maps, segmentation masks, or VLA actions." },
  { label: "Watch", command: "openeye watch --safety", description: "Live camera feed with real-time detection, safety zone monitoring, and hazard alerts. Supports multi-model stacking." },
  { label: "Serve", command: "openeye serve yolov8 --port 8000", description: "Start a FastAPI server with REST API, WebSocket streams, Prometheus metrics, and a live dashboard." },
  { label: "Fleet", command: "openeye fleet ls --type robot", description: "Register, monitor, and deploy to edge devices. Supports canary rollouts, OTA updates, and real-time alerts." },
  { label: "MLOps", command: "openeye mlops status", description: "Manage model lifecycle with A/B testing, shadow deployments, feedback loops, and automated retraining pipelines." },
  { label: "Govern", command: "openeye govern audit --tail", description: "Enforce safety policies, review audit trails, and monitor policy violations across your perception fleet." },
  { label: "Bench", command: "openeye bench yolov8 --runs 20", description: "Benchmark any model's inference speed. Reports mean, median, and p95 latency with FPS across hardware targets." },
  { label: "Pull", command: "openeye pull grounding-dino", description: "Download and configure any vision model from the registry. Handles weights, dependencies, and runtime setup automatically." },
];

export const valueProps: ValueProp[] = [
  { label: "Safety-first", description: "Real-time human detection and robot halt" },
  { label: "Model-agnostic", description: "8 adapters: YOLO, RF-DETR, DINO, SAM 2, Depth, SmolVLA" },
  { label: "Self-hosted", description: "All inference runs locally — your data never leaves your network" },
  { label: "Open source", description: "Apache 2.0 — inspect, modify, deploy freely" },
];
