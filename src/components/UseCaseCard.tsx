import { motion } from "framer-motion";
import { UseCase } from "@/data/useCasesData";

const ease = [0.2, 0.8, 0.2, 1] as const;

interface UseCaseSectionProps {
  uc: UseCase;
  index: number;
}

export function UseCaseSection({ uc, index }: UseCaseSectionProps) {
  return (
    <section
      id={uc.id}
      className={`py-[12vh] px-4 ${index % 2 === 0 ? "bg-card" : ""}`}
    >
      <div className="container max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.3, ease }}
        >
          <div
            className={`font-mono text-xs uppercase tracking-widest ${uc.overlineColor} mb-4`}
          >
            {uc.overline}
          </div>
          <h2 className="text-3xl md:text-4xl font-semibold font-display mb-4">
            {uc.title}
          </h2>
          <p className="text-muted-foreground mb-4 max-w-2xl">
            {uc.description}
          </p>
          <div className="font-mono text-sm bg-secondary text-oe-green px-4 py-2.5 rounded-inner border inline-block mb-12">
            {uc.terminalCommand}
          </div>
        </motion.div>

        {/* Hero image */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.3, delay: 0.05, ease }}
          className="relative aspect-[21/9] rounded-outer overflow-hidden border border-foreground/[0.06] mb-12"
        >
          <img
            src={uc.image}
            alt={uc.title}
            className="absolute inset-0 w-full h-full object-cover opacity-50"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/60 to-transparent" />
          <div className="absolute bottom-4 left-4 font-mono text-[10px] text-terminal-green/70 space-y-0.5">
            <div>OPENEYE v0.1.0 — {uc.overline.toUpperCase()}</div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-terminal-green animate-pulse" />
              LIVE
            </div>
          </div>
        </motion.div>

        {/* Scenario Grid */}
        <div className="grid sm:grid-cols-2 gap-6 mb-12">
          {uc.scenarios.map((scenario, i) => (
            <motion.div
              key={scenario.label}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{
                duration: 0.3,
                delay: 0.1 + i * 0.04,
                ease,
              }}
              className="border border-foreground/[0.06] rounded-outer p-6 bg-background/50"
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="text-muted-foreground">
                  {scenario.icon}
                </span>
                <span className="text-sm font-medium">
                  {scenario.label}
                </span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {scenario.detail}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.3, delay: 0.15, ease }}
          className="flex flex-wrap gap-8"
        >
          {uc.stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-2xl font-semibold font-display">
                {stat.value}
              </div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mt-1">
                {stat.label}
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
