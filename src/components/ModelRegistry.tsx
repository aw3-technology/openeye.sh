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
  running: "bg-oe-green/15 text-oe-green",
  ready: "bg-primary/15 text-primary",
  available: "bg-muted-foreground/15 text-muted-foreground",
};

const statusDiamond = {
  running: "bg-oe-green",
  ready: "bg-oe-blue",
  available: "bg-muted-foreground",
};

export function ModelRegistry() {
  return (
    <div className="bg-card rounded-outer border border-foreground/[0.06] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-foreground/[0.06]">
        <span className="w-2 h-2 rotate-45 bg-oe-blue" />
        <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
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
              <span className={`w-1.5 h-1.5 rotate-45 ${statusDiamond[model.status]}`} />
              <span className="text-foreground">{model.name}</span>
              <span className="text-muted-foreground text-xs">{model.task}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground text-xs tabular-nums">{model.size}</span>
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
