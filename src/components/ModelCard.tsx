import { motion } from "framer-motion";
import type { Model } from "@/data/models";
import { ease } from "@/lib/motion";


interface ModelCardProps {
  model: Model;
  index: number;
}

export function ModelCard({ model, index }: ModelCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.3, delay: 0.05 + index * 0.04, ease }}
      className="border border-foreground/[0.06] rounded-outer p-6 bg-foreground/[0.02] hover:bg-foreground/[0.04] transition-colors"
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="font-medium">{model.name}</div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {model.creator}
          </div>
        </div>
        <span
          className={`font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 border rounded-inner ${
            model.status === "integrated"
              ? "text-terminal-green border-terminal-green/20"
              : "text-muted-foreground border-foreground/10"
          }`}
        >
          {model.status}
        </span>
      </div>
      <div className="text-sm text-muted-foreground mb-3">{model.role}</div>
      <p className="text-sm text-muted-foreground leading-relaxed">
        {model.description}
      </p>
      {model.performance && (
        <div className="mt-4 font-mono text-xs text-terminal-green">
          {model.performance}
        </div>
      )}
      {model.provider && (
        <div className="mt-2 font-mono text-[10px] uppercase tracking-widest text-terminal-amber">
          via {model.provider}
        </div>
      )}
    </motion.div>
  );
}
