export interface PipelineLayer {
  overline: string;
  overlineColor: string;
  title: string;
  description: string;
  terminalCommand: string;
  details: string[];
}

export const pipelineLayers: PipelineLayer[] = [
  {
    overline: "Layer 1 — Camera Feed",
    overlineColor: "text-muted-foreground",
    title: "Any camera. Any format.",
    description:
      "OpenEye ingests video from USB cameras, RTSP network streams, and video files. Hardware-agnostic input layer with automatic format detection and frame extraction.",
    terminalCommand: "$ openeye watch --source rtsp://192.168.1.10:554/stream",
    details: [
      "USB webcams, industrial cameras, depth sensors",
      "RTSP, RTMP, HTTP-FLV network streams",
      "MP4, AVI, MKV video files",
      "Multi-camera support with frame synchronization",
    ],
  },
  {
    overline: "Layer 2 — Vision Engine",
    overlineColor: "text-terminal-green",
    title: "YOLO26 runs every frame.",
    description:
      "The fast detection layer processes every frame at 30fps using YOLO26. Model adapters let you swap to any supported detector without code changes. This is the safety-critical path — pure geometry, no LLM latency.",
    terminalCommand: "$ openeye detect image.jpg --model yolo26 --conf 0.4",
    details: [
      "YOLO26 as default fast-layer detector",
      "Model adapter pattern for hot-swapping",
      "Grounding DINO for open-vocabulary queries",
      "SAM 2 for pixel-precise segmentation",
    ],
  },
  {
    overline: "Layer 3 — Scene Understanding",
    overlineColor: "text-terminal-green",
    title: "Objects become a world model.",
    description:
      "Raw detections are composed into a structured scene graph with spatial relationships, hazard classifications, and environment context. This is the representation that downstream systems consume.",
    terminalCommand: "$ openeye scene image.jpg --format json",
    details: [
      "Scene graph with typed objects and positions",
      "Spatial relationships (on, near, inside, above)",
      "Hazard classification (sharp, hot, unstable, blocking)",
      "Environment context and zone mapping",
    ],
  },
  {
    overline: "Layer 4 — LLM Reasoning",
    overlineColor: "text-terminal-amber",
    title: "The smart layer thinks.",
    description:
      "Every 2-3 seconds, a VLM analyzes the scene for context-dependent risks that geometry alone can't catch. Powered by Qwen2.5-VL via Nebius Token Factory for fast, affordable inference.",
    terminalCommand: "$ openeye watch --reason --vlm qwen2.5-vl",
    details: [
      "Qwen2.5-VL for multimodal scene reasoning",
      "Nebius Token Factory for hosted inference",
      "OpenRouter fallback for model flexibility",
      "Catches context-dependent risks (knife near edge, unstable stack)",
    ],
  },
  {
    overline: "Layer 5 — Action Planner",
    overlineColor: "text-muted-foreground",
    title: "Goals become action plans.",
    description:
      "Given a natural language goal and the current scene graph, the planner generates structured multi-step action plans with safety constraints. Each step is grounded in what OpenEye actually sees.",
    terminalCommand: '$ openeye plan "clear the workspace" --steps',
    details: [
      "Natural language goal decomposition",
      "Plans grounded in real-time scene state",
      "Safety constraints on every action step",
      "Affordance-aware manipulation planning",
    ],
  },
  {
    overline: "Layer 6 — Robot Adapter",
    overlineColor: "text-terminal-green",
    title: "Plans become robot actions.",
    description:
      "The adapter layer translates action plans into robot-specific commands. Support for Solo CLI, OpenClaw, and ROS integration. Halt signals bypass the full pipeline for sub-100ms emergency stops.",
    terminalCommand: "$ openeye exec --adapter solo-cli --plan plan.json",
    details: [
      "Solo CLI for direct servo control",
      "OpenClaw for dexterous manipulation",
      "ROS 2 integration (coming soon)",
      "Sub-100ms halt signal path",
    ],
  },
];
