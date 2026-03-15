import { motion } from "framer-motion";

const layers = [
  { label: "Camera Feed", sub: "USB / RTSP / Video File", color: "terminal-fg" },
  { label: "Vision Engine", sub: "YOLOv8 · GroundingDINO · SAM", color: "terminal-green" },
  { label: "Scene Understanding", sub: "Objects · Spatial Map · Hazards", color: "terminal-green" },
  { label: "LLM Reasoning", sub: "OpenRouter · Nebius Token Factory", color: "terminal-amber" },
  { label: "Action Planner", sub: "Structured Task Decomposition", color: "terminal-fg" },
  { label: "Robot Adapter", sub: "Solo CLI · OpenClaw · Simulation", color: "terminal-green" },
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
