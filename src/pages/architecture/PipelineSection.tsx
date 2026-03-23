import { motion } from "framer-motion";
import type { PipelineLayer } from "./pipeline-data";

const ease = [0.2, 0.8, 0.2, 1] as const;

export function PipelineSection({ layer, index }: { layer: PipelineLayer; index: number }) {
  return (
    <section
      className={`py-[12vh] px-4 ${index % 2 === 0 ? "bg-card" : ""}`}
    >
      <div className="container max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.3, ease }}
        >
          <div
            className={`font-mono text-xs uppercase tracking-widest ${layer.overlineColor} mb-4`}
          >
            {layer.overline}
          </div>
          <h2 className="text-3xl md:text-4xl font-semibold font-display mb-4">
            {layer.title}
          </h2>
          <p className="text-muted-foreground mb-4 max-w-2xl">
            {layer.description}
          </p>
          <div className="font-mono text-sm bg-secondary text-oe-green px-4 py-2.5 rounded-inner border inline-block mb-8">
            {layer.terminalCommand}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.3, delay: 0.1, ease }}
          className="grid sm:grid-cols-2 gap-4"
        >
          {layer.details.map((detail, j) => (
            <div
              key={j}
              className="flex items-start gap-3 p-4 border border-foreground/[0.06] rounded-outer bg-foreground/[0.02]"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-terminal-green mt-1.5 flex-shrink-0" />
              <span className="text-sm text-muted-foreground">
                {detail}
              </span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
