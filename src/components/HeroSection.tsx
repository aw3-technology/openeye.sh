import { motion } from "framer-motion";
import { InteractiveTerminal } from "@/components/InteractiveTerminal";
import { valueProps } from "@/data/indexPageData";

export function HeroSection() {
  return (
    <section className="pt-28 pb-[15vh] px-4">
      <div className="container max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-6">
              Open-Source Perception Engine
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold font-display leading-[1.05] mb-6">
              Open-source eyes for the agent era.
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed mb-6 max-w-lg">
              A perception engine that turns raw video into structured world models for robots and autonomous agents. Use the hosted API or self-host — see, understand, and act safely.
            </p>

            <div className="grid grid-cols-2 gap-3 mb-8">
              {valueProps.map((prop) => (
                <div key={prop.label} className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-terminal-green mt-1.5 flex-shrink-0" />
                  <div>
                    <div className="text-sm font-medium">{prop.label}</div>
                    <div className="text-xs text-muted-foreground">{prop.description}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              <a
                href="#get-started"
                className="font-mono text-sm bg-foreground text-background px-5 py-2.5 rounded-inner hover:bg-foreground/90 transition-colors active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-foreground/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background outline-none"
              >
                Get Started
              </a>
              <div className="font-mono text-sm bg-secondary text-oe-green px-4 py-2.5 rounded-inner border select-all cursor-text" role="textbox" aria-label="Install command">
                pipx install openeye-sh
              </div>
              <a
                href="https://github.com/aw3-technology/openeye.sh"
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-sm text-muted-foreground px-4 py-2.5 rounded-inner border border-foreground/[0.06] hover:text-foreground hover:border-foreground/10 transition-colors active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-foreground/50 outline-none"
              >
                GitHub
              </a>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <InteractiveTerminal />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
