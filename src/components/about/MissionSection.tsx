import { motion } from "framer-motion";
import logoVertical from "@/assets/openeye-logo-vertical.png";
import { ease } from "@/lib/motion";


export function MissionSection() {
  return (
    <section className="py-[12vh] px-4 bg-card">
      <div className="container max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.3, ease }}
          >
            <div className="font-mono text-xs uppercase tracking-widest text-terminal-green mb-4">
              Mission
            </div>
            <h2 className="text-3xl md:text-4xl font-semibold font-display mb-4">
              Who watches the robots?
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-6">
              Robots are entering homes, warehouses, and public spaces faster
              than safety infrastructure can keep up. Most perception systems
              are closed-source, cloud-dependent, and impossible to audit.
            </p>
            <p className="text-muted-foreground leading-relaxed mb-6">
              OpenEye exists to change that. We're building a CLI-first,
              model-agnostic perception engine that any developer can inspect,
              modify, and deploy — with safety as the default, not an
              afterthought.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Our goal is simple: make it trivially easy to give any robot or
              agent the ability to see, understand, and act safely in the
              physical world.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.3, delay: 0.1, ease }}
            className="flex justify-center"
          >
            <img
              src={logoVertical}
              alt="OpenEye"
              className="h-48 opacity-60"
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
