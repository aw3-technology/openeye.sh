import { motion } from "framer-motion";
import { Link } from "react-router-dom";

const dashboardFeatures = [
  { label: "Live Stream", description: "Real-time camera feeds with detection overlays, safety zone HUD, FPS/latency color coding, and VLM reasoning panel" },
  { label: "Fleet Management", description: "Device inventory, health monitoring, deployment wizards, canary rollouts, maintenance scheduling, and alerts" },
  { label: "Agentic Loop", description: "Continuous perception-reasoning-action cycle with memory, scene graphs, and chain-of-thought planning" },
  { label: "MLOps", description: "A/B testing, shadow deployments, feedback loops, model lifecycle management, and automated retraining" },
  { label: "Governance", description: "Policy editor, violation monitoring, audit trails, and safety presets to enforce compliance across your fleet" },
  { label: "Model Registry", description: "Browse available models, benchmark results, check installed versions, and manage adapters from the dashboard" },
];

export function ProductionDashboardSection() {
  return (
    <section className="py-[15vh] px-4">
      <div className="container max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">
            Dashboard
          </div>
          <h2 className="text-3xl md:text-4xl font-semibold font-display mb-4">
            Monitor and manage your perception stack.
          </h2>
          <p className="text-muted-foreground mb-12 max-w-2xl">
            A built-in web dashboard for managing devices, monitoring camera feeds, enforcing safety policies, and running MLOps workflows.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {dashboardFeatures.map((feature, i) => (
            <motion.div
              key={feature.label}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05, duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
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
          transition={{ delay: 0.2, duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
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
