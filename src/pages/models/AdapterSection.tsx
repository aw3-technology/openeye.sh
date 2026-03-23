import { motion } from "framer-motion";
import { adapterSteps } from "@/data/modelsData";

const ease = [0.2, 0.8, 0.2, 1] as const;

export function AdapterSection() {
  return (
    <section className="py-[12vh] px-4 bg-card">
      <div className="container max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.3, ease }}
        >
          <div className="font-mono text-xs uppercase tracking-widest text-terminal-green mb-4">
            Model Adapter Pattern
          </div>
          <h2 className="text-3xl md:text-4xl font-semibold font-display mb-4">
            One interface for every model.
          </h2>
          <p className="text-muted-foreground mb-12 max-w-2xl">
            Every model implements a shared adapter interface. The pipeline
            doesn't know or care which model is running — it just calls
            predict(). Swap models without touching application code.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {adapterSteps.map((step, i) => (
            <motion.div
              key={step.step}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: 0.05 + i * 0.04, ease }}
              className="border border-foreground/[0.06] rounded-outer p-6 bg-foreground/[0.02]"
            >
              <div className="font-mono text-2xl font-semibold text-terminal-green/30 mb-3">
                {step.step}
              </div>
              <div className="text-lg font-semibold font-display mb-2">
                {step.title}
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Adapter code example */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.3, delay: 0.2, ease }}
          className="mt-12 border border-foreground/[0.06] rounded-outer bg-secondary overflow-hidden"
        >
          <div className="px-4 py-2.5 border-b border-foreground/[0.06] flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-foreground/10" />
            <div className="w-2.5 h-2.5 rounded-full bg-foreground/10" />
            <div className="w-2.5 h-2.5 rounded-full bg-foreground/10" />
            <span className="font-mono text-[10px] text-muted-foreground ml-2">
              adapters/yolo_adapter.py
            </span>
          </div>
          <pre className="px-6 py-5 font-mono text-sm text-oe-green overflow-x-auto leading-relaxed">
            <code>{`class YOLOAdapter(ModelAdapter):
    """Drop-in adapter for any YOLO model."""

    def load(self, weights: str = "yolo26n.pt"):
        self.model = YOLO(weights)

    def predict(self, frame: np.ndarray) -> list[Detection]:
        results = self.model(frame, conf=self.conf)
        return self.postprocess(results)

# Register — one line, done.
registry.register("yolo26", YOLOAdapter)`}</code>
          </pre>
        </motion.div>
      </div>
    </section>
  );
}
