import { motion } from "framer-motion";

const layers = [
  { label: "Camera Feed", sub: "USB · RTSP · Video Files · Simulated Feeds", color: "oe-blue" },
  { label: "Vision Engine", sub: "YOLO26 · Grounding DINO · SAM 2 · RF-DETR", color: "oe-blue" },
  { label: "Scene Understanding", sub: "Objects · Spatial Map · Hazards", color: "oe-blue" },
  { label: "LLM Reasoning", sub: "Qwen2.5-VL · OpenRouter · Nebius Token Factory", color: "oe-red" },
  { label: "Action Planner", sub: "Structured Task Decomposition", color: "oe-blue" },
  { label: "Robot Adapter", sub: "Unitree G1 · SmolVLA · Simulation", color: "oe-green" },
];

function Diamond({ colorClass }: { colorClass: string }) {
  return <span className={`inline-block w-2 h-2 rotate-45 ${colorClass} shrink-0`} />;
}

const layerDiamondColors = [
  "bg-oe-blue",
  "bg-oe-blue",
  "bg-oe-blue",
  "bg-oe-red",
  "bg-oe-blue",
  "bg-oe-green",
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
          <div className="bg-card border border-foreground/[0.06] rounded-inner px-4 py-3 flex items-center gap-3">
            <Diamond colorClass={layerDiamondColors[i]} />
            <div className="text-left">
              <div className="font-mono text-sm text-foreground">{layer.label}</div>
              <div className="font-mono text-[11px] text-muted-foreground mt-0.5">{layer.sub}</div>
            </div>
          </div>
          {i < layers.length - 1 && (
            <div className="flex justify-center py-1">
              <div className="w-px h-4 bg-primary/30" />
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
}
