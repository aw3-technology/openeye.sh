import { motion } from "framer-motion";

const ease = [0.2, 0.8, 0.2, 1] as const;

export function HeroSection() {
  return (
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
  );
}
