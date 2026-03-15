import { motion } from "framer-motion";

interface Model {
  name: string;
  task: string;
  size: string;
  status: "ready" | "available" | "running";
}

const models: Model[] = [
  { name: "yolov8", task: "object-detection", size: "6.2 MB", status: "running" },
  { name: "depth-anything", task: "depth-estimation", size: "98 MB", status: "running" },
  { name: "groundingdino", task: "open-vocab-detection", size: "662 MB", status: "ready" },
  { name: "sam2", task: "segmentation", size: "358 MB", status: "available" },
  { name: "smolvla", task: "vision-language-action", size: "450 MB", status: "available" },
];

const statusStyles = {
  running: "bg-terminal-green/20 text-terminal-green",
  ready: "bg-terminal-amber/20 text-terminal-amber",
  available: "bg-terminal-muted/20 text-terminal-muted",
};

export function ModelRegistry() {
  return (
    <div className="bg-terminal-bg rounded-outer border border-foreground/5 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-foreground/5">
        <span className="font-mono text-xs text-terminal-muted uppercase tracking-widest">
          Model Registry — openeye list
        </span>
      </div>
      <div className="p-4 md:p-6 space-y-2">
        {models.map((model, i) => (
          <motion.div
            key={model.name}
            initial={{ opacity: 0, x: -6 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.05, duration: 0.15, ease: [0.2, 0.8, 0.2, 1] }}
            className="flex items-center justify-between font-mono text-sm py-1.5"
          >
            <div className="flex items-center gap-3">
              <span className="text-terminal-green">{model.name}</span>
              <span className="text-terminal-muted text-xs">{model.task}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-terminal-muted text-xs tabular-nums">{model.size}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-inner uppercase tracking-wider ${statusStyles[model.status]}`}>
                {model.status}
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
