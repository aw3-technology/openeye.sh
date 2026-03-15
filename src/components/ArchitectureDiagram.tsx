import { motion } from "framer-motion";

const layers = [
  { label: "Model Registry", sub: "openeye pull — YOLOv8 · GroundingDINO · SAM2 · SmolVLA", color: "terminal-green" },
  { label: "Unified Runtime", sub: "Weights · Dependencies · Inference Engine", color: "terminal-green" },
  { label: "Camera Adapter", sub: "USB · RTSP · Video Files · Simulated Feeds", color: "terminal-fg" },
  { label: "Structured Output", sub: "JSON Scene Graph · Detections · Depth Maps · Actions", color: "terminal-green" },
  { label: "Safety Monitor", sub: "Anomaly Detection · Workspace Baseline · Agent Halt", color: "terminal-amber" },
  { label: "Agent Bus", sub: "OpenClaw Skills · REST API · Robot Adapters", color: "terminal-green" },
];

export function ArchitectureDiagram() {
  return (
    <div className="flex flex-col items-center gap-0">
      {layers.map((layer, i) => (
        <motion.div
          key={layer.label}
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.05, duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
          className="w-full max-w-md"
        >
          <div className="bg-terminal-bg border border-foreground/5 rounded-inner px-4 py-3 text-center">
            <div className={`font-mono text-sm text-${layer.color}`}>{layer.label}</div>
            <div className="font-mono text-[11px] text-terminal-muted mt-0.5">{layer.sub}</div>
          </div>
          {i < layers.length - 1 && (
            <div className="flex justify-center py-1">
              <div className="w-px h-4 bg-terminal-green/30" />
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
}
