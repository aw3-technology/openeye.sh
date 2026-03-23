import { motion } from "framer-motion";
import { Link } from "react-router-dom";

const ease = [0.2, 0.8, 0.2, 1] as const;

export function CtaSection() {
  return (
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
  );
}
