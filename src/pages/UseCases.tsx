import { useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ShieldCheck, Zap, Eye, Cog } from "lucide-react";
import { useCases } from "@/data/useCasesData";
import { UseCaseSection } from "@/components/UseCaseCard";

const ease = [0.2, 0.8, 0.2, 1] as const;

export default function UseCases() {
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = "Use Cases | OpenEye";
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
              Use Cases
            </div>
            <h1 className="text-4xl md:text-5xl font-semibold font-display leading-[1.05] mb-4">
              Perception for every robot.
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl">
              OpenEye adapts to any environment where machines and humans
              coexist. From factory floors to family kitchens to autonomous agent
              frameworks — the same perception engine, tuned for each context.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Quick Nav */}
      <section className="px-4 pb-16">
        <div className="container max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1, ease }}
            className="grid sm:grid-cols-3 gap-4"
          >
            {useCases.map((uc) => (
              <a
                key={uc.id}
                href={`#${uc.id}`}
                className="group border border-foreground/[0.06] rounded-outer p-5 bg-foreground/[0.02] hover:bg-foreground/[0.04] transition-colors focus-visible:ring-2 focus-visible:ring-terminal-green outline-none"
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className={uc.overlineColor}>{uc.icon}</span>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    {uc.overline}
                  </span>
                </div>
                <p className="text-sm font-medium leading-snug group-hover:text-foreground transition-colors">
                  {uc.subtitle.split(".")[0]}.
                </p>
              </a>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Use Case Deep Dives */}
      {useCases.map((uc, ucIdx) => (
        <UseCaseSection key={uc.id} uc={uc} index={ucIdx} />
      ))}

      {/* Cross-Cutting Capabilities */}
      <section className="py-[12vh] px-4">
        <div className="container max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.3, ease }}
          >
            <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">
              Every Use Case
            </div>
            <h2 className="text-3xl md:text-4xl font-semibold font-display mb-12">
              Shared capabilities across verticals.
            </h2>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: <ShieldCheck className="w-5 h-5 text-terminal-green" aria-hidden="true" />,
                label: "Safety-first architecture",
                detail:
                  "Dual-layer detection — fast YOLO geometry for real-time halt, VLM reasoning for context-dependent risks.",
              },
              {
                icon: <Zap className="w-5 h-5 text-terminal-amber" aria-hidden="true" />,
                label: "Real-time performance",
                detail:
                  "Real-time detection pipeline with low-latency halt capability. All inference runs locally — no cloud round-trips.",
              },
              {
                icon: <Eye className="w-5 h-5 text-terminal-green" aria-hidden="true" />,
                label: "Model-agnostic",
                detail:
                  "Swap YOLO, Grounding DINO, Depth Anything, or any custom model without code changes via the adapter system.",
              },
              {
                icon: <Cog className="w-5 h-5 text-muted-foreground" aria-hidden="true" />,
                label: "Hardware-agnostic",
                detail:
                  "Works with USB cameras, RTSP streams, and video files. CPU, CUDA, and Apple Silicon MPS supported.",
              },
            ].map((cap, i) => (
              <motion.div
                key={cap.label}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: 0.05 + i * 0.04, ease }}
                className="space-y-3"
              >
                {cap.icon}
                <div className="text-sm font-medium">{cap.label}</div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {cap.detail}
                </p>
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
              Build for your use case.
            </h2>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
              OpenEye is open-source and extensible. Start with the CLI, connect
              your cameras, and adapt the perception pipeline to your
              environment.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                to="/#get-started"
                className="font-mono text-sm bg-foreground text-background px-5 py-2.5 rounded-inner hover:bg-foreground/90 transition-colors active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-terminal-green focus-visible:ring-offset-2 focus-visible:ring-offset-background outline-none"
              >
                Get Started
              </Link>
              <div className="font-mono text-sm bg-secondary text-oe-green px-4 py-2.5 rounded-inner border select-all cursor-text">
                pip install openeye-ai
              </div>
              <a
                href="https://github.com/openeye-ai"
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-sm text-muted-foreground px-4 py-2.5 rounded-inner border border-foreground/[0.06] hover:text-foreground hover:border-foreground/10 transition-colors active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-terminal-green outline-none"
              >
                GitHub
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
