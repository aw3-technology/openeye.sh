import { motion } from "framer-motion";
import { useCases } from "@/data/useCasesData";
import { Link } from "react-router-dom";

const ease = [0.2, 0.8, 0.2, 1] as const;

export function UseCasesSection() {
  return (
    <section className="py-[15vh] px-4">
      <div className="container max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.3, ease }}
        >
          <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">
            Use Cases
          </div>
          <h2 className="text-3xl md:text-4xl font-semibold font-display mb-4">
            Built for the physical world.
          </h2>
          <p className="text-muted-foreground mb-12 max-w-2xl">
            From robot safety to desktop automation — OpenEye gives machines structured visual understanding.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {useCases.map((uc, i) => (
            <motion.div
              key={uc.id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.3, ease }}
              className="border border-foreground/[0.06] rounded-outer overflow-hidden bg-foreground/[0.02] flex flex-col"
            >
              <div className="relative aspect-[16/9] bg-secondary">
                <img
                  src={uc.image}
                  alt={uc.title}
                  className="absolute inset-0 w-full h-full object-cover opacity-60"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
              </div>
              <div className="p-6 flex flex-col flex-1">
              <div className={`font-mono text-xs uppercase tracking-widest ${uc.overlineColor} mb-3 flex items-center gap-2`}>
                {uc.icon}
                {uc.overline}
              </div>
              <h3 className="font-display text-lg font-semibold mb-2">
                {uc.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4 flex-1">
                {uc.subtitle}
              </p>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {uc.scenarios.slice(0, 4).map((s) => (
                  <div
                    key={s.label}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground"
                  >
                    <span className="text-muted-foreground/60 shrink-0">{s.icon}</span>
                    <span className="truncate">{s.label}</span>
                  </div>
                ))}
              </div>
              <div className="font-mono text-xs bg-secondary text-oe-green px-3 py-2 rounded-inner border overflow-x-auto">
                {uc.terminalCommand}
              </div>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2, duration: 0.3, ease }}
          className="text-center"
        >
          <Link
            to="/use-cases"
            className="font-mono text-sm text-primary hover:underline"
          >
            Explore all use cases →
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
