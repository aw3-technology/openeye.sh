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
            The perception layer is open.
          </h2>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto">
            Give your robots and agents the ability to see, understand, and
            act. Start building with OpenEye today.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              to="/#get-started"
              className="font-mono text-sm bg-foreground text-background px-5 py-2.5 rounded-inner hover:bg-foreground/90 transition-colors active:scale-[0.98]"
            >
              Get Started
            </Link>
            <div className="font-mono text-sm bg-terminal-bg text-terminal-green px-4 py-2.5 rounded-inner border border-foreground/5">
              pip install openeye-ai
            </div>
            <a
              href="https://github.com/openeye-ai"
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-sm text-muted-foreground px-4 py-2.5 rounded-inner border border-foreground/[0.06] hover:text-foreground hover:border-foreground/10 transition-colors active:scale-[0.98]"
            >
              Star on GitHub
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
