import { motion } from "framer-motion";
import { milestones } from "@/data/aboutData";

const ease = [0.2, 0.8, 0.2, 1] as const;

export function TimelineSection() {
  return (
    <section className="py-[12vh] px-4">
      <div className="container max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.3, ease }}
        >
          <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">
            Timeline
          </div>
          <h2 className="text-3xl md:text-4xl font-semibold font-display mb-12">
            Where we've been. Where we're going.
          </h2>
        </motion.div>

        <div className="max-w-2xl space-y-0">
          {milestones.map((milestone, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{
                duration: 0.3,
                delay: 0.05 + i * 0.04,
                ease,
              }}
              className="flex items-start gap-6 py-4 border-b border-foreground/[0.06] last:border-0"
            >
              <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground w-24 flex-shrink-0 pt-0.5">
                {milestone.date}
              </div>
              <div className="flex items-start gap-3">
                <span
                  className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${milestone.date === "Next" ? "bg-terminal-amber" : "bg-terminal-green"}`}
                />
                <span className="text-sm">{milestone.event}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
