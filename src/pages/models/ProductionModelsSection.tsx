import { motion } from "framer-motion";
import { productionModels } from "@/data/modelsData";

const ease = [0.2, 0.8, 0.2, 1] as const;

export function ProductionModelsSection() {
  return (
    <section className="py-[12vh] px-4 bg-card">
      <div className="container max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.3, ease }}
        >
          <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">
            Integrated Today
          </div>
          <h2 className="text-3xl md:text-4xl font-semibold font-display mb-12">
            Production-ready models.
          </h2>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {productionModels.map((model, i) => (
            <motion.div
              key={model.name}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: 0.05 + i * 0.04, ease }}
              className="text-center p-6 border border-foreground/[0.06] rounded-outer bg-foreground/[0.02] hover:bg-foreground/[0.04] transition-colors"
            >
              <div className="text-lg font-semibold font-display mb-1">
                {model.name}
              </div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">
                {model.role}
              </div>
              <div className="font-mono text-sm text-terminal-green">
                {model.stat}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
