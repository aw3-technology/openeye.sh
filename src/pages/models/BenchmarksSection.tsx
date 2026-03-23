import { motion } from "framer-motion";
import { benchmarks } from "@/data/modelsData";

const ease = [0.2, 0.8, 0.2, 1] as const;

export function BenchmarksSection() {
  return (
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
  );
}
