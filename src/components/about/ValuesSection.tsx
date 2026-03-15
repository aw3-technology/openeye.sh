import { motion } from "framer-motion";
import { values } from "@/data/aboutData";
import { ease } from "@/lib/motion";


export function ValuesSection() {
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
            Principles
          </div>
          <h2 className="text-3xl md:text-4xl font-semibold font-display mb-12">
            What we believe.
          </h2>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {values.map((value, i) => (
            <motion.div
              key={value.label}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{
                duration: 0.3,
                delay: 0.05 + i * 0.04,
                ease,
              }}
              className="space-y-3"
            >
              {value.icon}
              <div className="text-sm font-medium">{value.label}</div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {value.detail}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
