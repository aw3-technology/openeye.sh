import { motion } from "framer-motion";
import { modelGroups } from "@/data/modelsData";

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

export function StatsSection() {
  return (
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
  );
}
