import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ease } from "@/lib/motion";

const dashboardFeatures = [
  { label: "Live Stream", description: "Real-time camera feeds with detection overlays, safety zone HUD, and FPS metrics" },
  { label: "Fleet Management", description: "Device inventory, health monitoring, OTA updates, and deployment orchestration across edge nodes" },
  { label: "Model Registry", description: "Browse available models, check installed versions, and manage adapters from the dashboard" },
  { label: "Agentic Loop", description: "Continuous perception-reasoning-action cycle with memory, scene graphs, and chain-of-thought planning" },
];

export function ProductionDashboardSection() {
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
            Dashboard
          </div>
          <h2 className="text-3xl md:text-4xl font-semibold font-display mb-4">
            Monitor and manage your perception stack.
          </h2>
          <p className="text-muted-foreground mb-12 max-w-2xl">
            A built-in web dashboard for managing devices, monitoring camera feeds, and exploring model outputs.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {dashboardFeatures.map((feature, i) => (
            <motion.div
              key={feature.label}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05, duration: 0.2, ease }}
              className="border border-foreground/[0.06] rounded-outer p-5 bg-background"
            >
              <div className="font-mono text-xs uppercase tracking-widest text-terminal-green mb-2">
                {feature.label}
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2, duration: 0.2, ease }}
          className="text-center"
        >
          <Link
            to="/dashboard"
            className="font-mono text-sm text-muted-foreground hover:text-foreground border border-foreground/[0.06] hover:border-foreground/10 px-5 py-2.5 rounded-inner transition-colors active:scale-[0.98] inline-block"
          >
            Explore the Dashboard &rarr;
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
