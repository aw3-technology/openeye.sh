import { useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ModelCard } from "@/components/ModelCard";
import {
  modelGroups,
  productionModels,
  benchmarks,
  adapterSteps,
  modelFaqs,
} from "@/data/modelsData";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const ease = [0.2, 0.8, 0.2, 1] as const;

const allModels = modelGroups.flatMap((g) => g.models);
const integratedCount = allModels.filter(
  (m) => m.status === "integrated"
).length;
const plannedCount = allModels.filter((m) => m.status === "planned").length;

const stats = [
  { value: `${allModels.length}`, label: "Models" },
  { value: `${modelGroups.length}`, label: "Categories" },
  { value: `${integratedCount}`, label: "Integrated" },
  { value: `${plannedCount}`, label: "On Roadmap" },
];

export default function Models() {
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = "Models | OpenEye";
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="pt-28 pb-16 px-4">
        <div className="container max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease }}
          >
            <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">
              Supported Models
            </div>
            <h1 className="text-4xl md:text-5xl font-semibold font-display leading-[1.05] mb-4">
              Every model. One interface.
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl">
              OpenEye abstracts the vision layer so you can swap detection,
              segmentation, and reasoning models without changing application
              code. Use the best model for your use case.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="px-4 pb-16">
        <div className="container max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.05, ease }}
            className="grid grid-cols-2 md:grid-cols-4 gap-6"
          >
            {stats.map((s) => (
              <div
                key={s.label}
                className="text-center p-6 border border-foreground/[0.06] rounded-outer bg-foreground/[0.02]"
              >
                <div className="text-3xl font-semibold font-display text-terminal-green mb-1">
                  {s.value}
                </div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {s.label}
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* How model swapping works */}
      <section className="px-4 pb-16">
        <div className="container max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1, ease }}
            className="border border-foreground/[0.06] rounded-outer p-8 bg-foreground/[0.02]"
          >
            <div className="font-mono text-xs uppercase tracking-widest text-terminal-green mb-4">
              How It Works
            </div>
            <h2 className="text-2xl font-semibold font-display mb-4">
              Swap models from the CLI.
            </h2>
            <p className="text-muted-foreground mb-6 max-w-xl">
              The model adapter layer lets you switch between any supported model
              with a single flag. No code changes, no redeployment.
            </p>
            <div className="space-y-2">
              <div className="font-mono text-sm bg-secondary text-oe-green px-4 py-2.5 rounded-inner border">
                $ openeye run yolov8 image.jpg
              </div>
              <div className="font-mono text-sm bg-secondary text-oe-green px-4 py-2.5 rounded-inner border">
                $ openeye run grounding-dino image.jpg --prompt "red mug"
              </div>
              <div className="font-mono text-sm bg-secondary text-oe-green px-4 py-2.5 rounded-inner border">
                $ openeye run depth-anything scene.jpg
              </div>
              <div className="font-mono text-sm bg-secondary text-oe-green px-4 py-2.5 rounded-inner border">
                $ openeye run sam2 workspace.jpg --segment
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Adapter Architecture */}
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

      {/* Model Groups */}
      {modelGroups.map((group, gi) => (
        <section
          key={group.category}
          className={`py-[12vh] px-4 ${gi % 2 !== 0 ? "bg-card" : ""}`}
        >
          <div className="container max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, ease }}
            >
              <div
                className={`font-mono text-xs uppercase tracking-widest ${group.color} mb-4`}
              >
                {group.category}
              </div>
              <h2 className="text-3xl md:text-4xl font-semibold font-display mb-12">
                {group.heading}
              </h2>
            </motion.div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {group.models.map((model, i) => (
                <ModelCard key={model.name} model={model} index={i} />
              ))}
            </div>
          </div>
        </section>
      ))}

      {/* Performance Benchmarks */}
      <section className="py-[12vh] px-4 border-t border-foreground/[0.06]">
        <div className="container max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.3, ease }}
          >
            <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">
              Benchmarks
            </div>
            <h2 className="text-3xl md:text-4xl font-semibold font-display mb-4">
              Performance at a glance.
            </h2>
            <p className="text-muted-foreground mb-12 max-w-xl">
              Inference speed measured on NVIDIA RTX 4090. Accuracy on standard
              benchmarks (COCO val for detection, zero-shot for segmentation).
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.3, delay: 0.1, ease }}
            className="overflow-x-auto -mx-4 px-4"
          >
            <table className="w-full text-sm border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-foreground/[0.06]">
                  <th className="text-left py-3 pr-4 font-mono text-xs uppercase tracking-widest text-muted-foreground">
                    Model
                  </th>
                  <th className="text-left py-3 px-3 font-mono text-xs uppercase tracking-widest text-muted-foreground">
                    Task
                  </th>
                  <th className="text-left py-3 px-3 font-mono text-xs uppercase tracking-widest text-terminal-green">
                    Speed
                  </th>
                  <th className="text-left py-3 px-3 font-mono text-xs uppercase tracking-widest text-muted-foreground">
                    Accuracy
                  </th>
                  <th className="text-left py-3 px-3 font-mono text-xs uppercase tracking-widest text-muted-foreground">
                    Size
                  </th>
                  <th className="text-left py-3 px-3 font-mono text-xs uppercase tracking-widest text-muted-foreground">
                    Backend
                  </th>
                </tr>
              </thead>
              <tbody>
                {benchmarks.map((row) => (
                  <tr
                    key={row.model}
                    className="border-b border-foreground/[0.04] hover:bg-foreground/[0.02] transition-colors"
                  >
                    <td className="py-3 pr-4 font-medium">{row.model}</td>
                    <td className="py-3 px-3 text-muted-foreground">
                      {row.task}
                    </td>
                    <td className="py-3 px-3 font-mono text-terminal-green">
                      {row.speed}
                    </td>
                    <td className="py-3 px-3 font-mono text-xs text-muted-foreground">
                      {row.accuracy}
                    </td>
                    <td className="py-3 px-3 font-mono text-xs text-muted-foreground">
                      {row.size}
                    </td>
                    <td className="py-3 px-3 font-mono text-xs text-muted-foreground">
                      {row.backend}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        </div>
      </section>

      {/* Key Integrations */}
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

      {/* FAQ */}
      <section className="py-[12vh] px-4 border-t border-foreground/[0.06]">
        <div className="container max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.3, ease }}
            className="text-center mb-12"
          >
            <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">
              FAQ
            </div>
            <h2 className="text-3xl font-semibold font-display">
              Frequently asked questions
            </h2>
          </motion.div>

          <Accordion type="single" collapsible className="w-full">
            {modelFaqs.map((item, i) => (
              <AccordionItem
                key={i}
                value={`faq-${i}`}
                className="border-foreground/[0.06]"
              >
                <AccordionTrigger className="text-left text-sm font-medium hover:no-underline">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* CTA */}
      <section className="py-[12vh] px-4 border-t border-foreground/[0.06]">
        <div className="container max-w-6xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.3, ease }}
          >
            <h2 className="text-3xl md:text-4xl font-semibold font-display mb-4">
              Use the right model for the job.
            </h2>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
              Swap models with a single CLI flag. No code changes required.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                to="/docs"
                className="font-mono text-sm bg-foreground text-background px-5 py-2.5 rounded-inner hover:bg-foreground/90 transition-colors active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-terminal-green focus-visible:ring-offset-2 focus-visible:ring-offset-background outline-none"
              >
                Read the Docs
              </Link>
              <Link
                to="/architecture"
                className="font-mono text-sm text-muted-foreground px-4 py-2.5 rounded-inner border border-foreground/[0.06] hover:text-foreground hover:border-foreground/10 transition-colors active:scale-[0.98]"
              >
                View Architecture
              </Link>
              <div className="font-mono text-sm bg-secondary text-oe-green px-4 py-2.5 rounded-inner border select-all cursor-text">
                pipx install openeye-sh
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
