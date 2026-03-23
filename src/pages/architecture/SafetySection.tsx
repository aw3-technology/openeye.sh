import { motion } from "framer-motion";

const ease = [0.2, 0.8, 0.2, 1] as const;

export function SafetySection() {
  return (
    <section className="py-[12vh] px-4">
      <div className="container max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.3, ease }}
        >
          <div className="font-mono text-xs uppercase tracking-widest text-terminal-red mb-4">
            Safety Architecture
          </div>
          <h2 className="text-3xl md:text-4xl font-semibold font-display mb-4">
            Dual-layer safety by design.
          </h2>
          <p className="text-muted-foreground mb-12 max-w-2xl">
            Safety isn't a feature — it's the architecture. Two independent
            detection paths run in parallel, each optimized for different
            threat categories.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.3, delay: 0.05, ease }}
            className="border border-foreground/[0.06] rounded-outer p-8 bg-foreground/[0.02]"
          >
            <div className="font-mono text-xs uppercase tracking-widest text-terminal-green mb-4">
              Fast Layer
            </div>
            <h3 className="text-xl font-semibold font-display mb-3">
              Geometry-based detection
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              YOLO26 runs every frame at 30fps. Pure geometric checks — is a
              hand inside the workspace polygon? Sub-100ms halt signal. No
              LLM latency, no network dependency.
            </p>
            <div className="space-y-2 font-mono text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-terminal-green" />
                30fps continuous detection
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-terminal-green" />
                Sub-100ms halt latency
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-terminal-green" />
                Works fully offline
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.3, delay: 0.1, ease }}
            className="border border-foreground/[0.06] rounded-outer p-8 bg-foreground/[0.02]"
          >
            <div className="font-mono text-xs uppercase tracking-widest text-terminal-amber mb-4">
              Smart Layer
            </div>
            <h3 className="text-xl font-semibold font-display mb-3">
              Context-aware reasoning
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              VLM analyzes the scene every 2-3 seconds for risks that geometry
              alone can't catch. A knife that wasn't there before, an unstable
              stack, context-dependent hazards.
            </p>
            <div className="space-y-2 font-mono text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-terminal-amber" />
                2-3 second analysis cycle
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-terminal-amber" />
                Context-dependent risk detection
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-terminal-amber" />
                Powered by Nebius Token Factory
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
