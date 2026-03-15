import { motion } from "framer-motion";

const layers = [
  { label: "Model Registry", sub: "openeye pull — YOLOv8 · GroundingDINO · SAM2 · SmolVLA", color: "oe-blue" },
  { label: "Unified Runtime", sub: "Weights · Dependencies · Inference Engine", color: "oe-blue" },
  { label: "Camera Adapter", sub: "USB · RTSP · Video Files · Simulated Feeds", color: "foreground" },
  { label: "Structured Output", sub: "JSON Scene Graph · Detections · Depth Maps · Actions", color: "oe-blue" },
  { label: "Safety Monitor", sub: "Anomaly Detection · Workspace Baseline · Agent Halt", color: "oe-red" },
  { label: "Agent Bus", sub: "OpenClaw Skills · REST API · Robot Adapters", color: "oe-green" },
];

function Diamond({ colorClass }: { colorClass: string }) {
  return <span className={`inline-block w-2 h-2 rotate-45 ${colorClass} shrink-0`} />;
}

const layerDiamondColors = [
  "bg-oe-blue",
  "bg-oe-blue",
  "bg-foreground/60",
  "bg-oe-blue",
  "bg-oe-red",
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
