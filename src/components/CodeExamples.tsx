import { useState } from "react";
import { motion } from "framer-motion";
import { ease } from "@/lib/motion";

type Language = "python" | "http" | "ros";

const tabs: { key: Language; label: string; badge?: string }[] = [
  { key: "python", label: "Python" },
  { key: "http", label: "Self-Hosted API" },
  { key: "ros", label: "ROS 2", badge: "Roadmap" },
];

const codeSnippets: Record<Language, { code: string; description: string }> = {
  python: {
    description: "Use the Python SDK to detect objects, estimate depth, and run safety monitoring.",
    code: `from openeye import OpenEye

eye = OpenEye()

# Run object detection with YOLOv8
result = eye.run("yolov8", "workspace.jpg")
for obj in result.objects:
    print(f"{obj.label}: {obj.confidence:.1%} at {obj.bbox}")

# Depth estimation
depth = eye.run("depth-anything", "scene.jpg")
print(depth.depth_map)   # base64-encoded depth map

# Grounded detection with text prompt
result = eye.run("grounding-dino", "kitchen.jpg",
                 prompt="find the coffee mug")
print(result.objects)    # open-vocabulary detections

# Live camera with safety monitoring
for frame in eye.watch(models=["yolov8"], safety=True):
    if frame.safety_alerts:
        print(f"ALERT: {frame.safety_alerts[0].zone_level}")`,
  },
  http: {
    description: "Self-host the API on your own infrastructure. REST and WebSocket endpoints built in.",
    code: `# Start the server locally
openeye serve yolov8 --port 8000

# Detect objects in an image
curl -X POST http://localhost:8000/predict \\
  -F "file=@workspace.jpg" | jq

# Self-host today — same API, your hardware:
openeye serve yolov8 --port 8000

curl -X POST http://localhost:8000/predict \\
  -F "file=@workspace.jpg" | jq

# Response:
# {
#   "model": "yolov8",
#   "objects": [
#     { "label": "cup", "confidence": 0.94,
#       "bbox": { "x1": 0.46, "y1": 0.52, "x2": 0.50, "y2": 0.63 } }
#   ],
#   "image": { "width": 1280, "height": 720 },
#   "inference_ms": 14.2
# }

# Stream detections via WebSocket
wscat -c ws://localhost:8000/ws

# Health check
curl http://localhost:8000/health

# Read / update config
curl http://localhost:8000/config
curl -X PUT http://localhost:8000/config -d '{"backend":"onnx"}'`,
  },
  ros: {
    description: "ROS 2 integration is on the roadmap. Subscribe to OpenEye topics for real-time perception in your robot stack.",
    code: `# ROS 2 adapter — coming soon
# Track progress: github.com/openeye-ai/openeye/issues

import rclpy
from rclpy.node import Node
from openeye_msgs.msg import SceneGraph, Detection, HazardAlert

class PerceptionNode(Node):
    def __init__(self):
        super().__init__("openeye_listener")

        # Subscribe to real-time detections
        self.create_subscription(
            Detection, "/openeye/detections", self.on_detect, 10
        )

        # Subscribe to scene graph updates
        self.create_subscription(
            SceneGraph, "/openeye/scene", self.on_scene, 10
        )

        # Subscribe to hazard alerts (safety-critical)
        self.create_subscription(
            HazardAlert, "/openeye/hazards", self.on_hazard, 10
        )

    def on_detect(self, msg):
        self.get_logger().info(
            f"Detected {msg.label} ({msg.confidence:.0%})"
        )

    def on_scene(self, msg):
        self.get_logger().info(
            f"Scene: {msg.object_count} objects, "
            f"{msg.hazard_count} hazards"
        )

    def on_hazard(self, msg):
        self.get_logger().error(f"HAZARD: {msg.description}")
        # Trigger emergency stop
        self.publish_halt()`,
  },
};

function SyntaxLine({ line, language }: { line: string; language: Language }) {
  if (!line.trim()) return <div className="h-4" />;

  // Comment lines
  if (line.trimStart().startsWith("#")) {
    return <div className="text-terminal-muted">{line}</div>;
  }

  // Curl commands
  if (language === "http" && line.trimStart().startsWith("curl")) {
    return <div className="text-terminal-green">{line}</div>;
  }

  // Python imports
  if ((language === "python" || language === "ros") && (line.trimStart().startsWith("from ") || line.trimStart().startsWith("import "))) {
    return <div className="text-terminal-amber">{line}</div>;
  }

  // Class / def / for / if / with lines
  if (/^\s*(class |def |for |if |with )/.test(line)) {
    return <div className="text-terminal-green">{line}</div>;
  }

  return <div className="text-terminal-fg">{line}</div>;
}

export function CodeExamples() {
  const [active, setActive] = useState<Language>("python");
  const snippet = codeSnippets[active];
  const lines = snippet.code.split("\n");

  return (
    <section id="integrations" className="py-[15vh] px-4">
      <div className="container max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.3, ease }}
        >
          <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">
            Integrations
          </div>
          <h2 className="text-3xl md:text-4xl font-semibold font-display mb-4">
            Works with your stack.
          </h2>
          <p className="text-muted-foreground mb-8 max-w-xl">
            Python SDK, self-hosted HTTP API, or upcoming ROS 2 topics — integrate OpenEye perception into any system.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Language tabs */}
          <div className="space-y-3" role="tablist" aria-label="Code examples by language">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActive(tab.key)}
                role="tab"
                aria-selected={active === tab.key}
                className={`w-full text-left px-4 py-3 rounded-inner border transition-all focus-visible:ring-2 focus-visible:ring-terminal-green focus-visible:ring-offset-1 focus-visible:ring-offset-background outline-none ${
                  active === tab.key
                    ? "bg-terminal-green/10 border-terminal-green/30 text-foreground"
                    : "bg-card border-foreground/[0.06] text-muted-foreground hover:text-foreground hover:border-foreground/10"
                }`}
              >
                <div className="font-mono text-sm font-medium flex items-center gap-2">
                  {tab.label}
                  {tab.badge && (
                    <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-terminal-amber/15 text-terminal-amber border border-terminal-amber/20">
                      {tab.badge}
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {tab.key === "python" && "SDK with full type hints"}
                  {tab.key === "http" && "Self-host on your hardware"}
                  {tab.key === "ros" && "Coming soon — on the roadmap"}
                </div>
              </button>
            ))}

            <p className="text-xs text-muted-foreground leading-relaxed pt-2">
              {snippet.description}
            </p>
          </div>

          {/* Code block */}
          <div className="lg:col-span-2">
            <div className="bg-card rounded-outer border overflow-hidden shadow-lg">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
                <div className="w-3 h-3 rounded-full bg-terminal-red/20 border border-terminal-red/50" />
                <div className="w-3 h-3 rounded-full bg-terminal-amber/20 border border-terminal-amber/50" />
                <div className="w-3 h-3 rounded-full bg-terminal-green/20 border border-terminal-green/50" />
                <span className="ml-2 text-xs font-mono text-muted-foreground uppercase tracking-widest">
                  {active === "python" ? "app.py" : active === "ros" ? "perception_node.py" : "terminal"}
                </span>
              </div>
              <div className="p-4 md:p-6 font-mono text-[13px] leading-relaxed overflow-x-auto scrollbar-thin max-h-[480px] overflow-y-auto">
                {lines.map((line, i) => (
                  <SyntaxLine key={`${active}-${i}`} line={line} language={active} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
