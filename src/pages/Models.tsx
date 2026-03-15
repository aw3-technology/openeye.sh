import { useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ModelCard } from "@/components/ModelCard";
import { modelGroups, productionModels } from "@/data/modelsData";

const ease = [0.2, 0.8, 0.2, 1] as const;

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
            </div>
          </motion.div>
        </div>
      </section>

      {/* Model Groups */}
      {modelGroups.map((group, gi) => (
        <section
          key={group.category}
          className={`py-[12vh] px-4 ${gi % 2 === 0 ? "bg-card" : ""}`}
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

      {/* Key Integrations */}
      <section className="py-[12vh] px-4">
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
                className="text-center p-6 border border-foreground/[0.06] rounded-outer bg-foreground/[0.02]"
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
              <div className="font-mono text-sm bg-terminal-bg text-terminal-green px-4 py-2.5 rounded-inner border border-foreground/5 select-all cursor-text">
                pip install openeye-ai
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
