import { motion } from "framer-motion";

export function DeployAnywhereSection() {
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
            Deploy Anywhere
          </div>
          <h2 className="text-3xl md:text-4xl font-semibold font-display mb-4">
            Your cameras. Your hardware. Your data.
          </h2>
          <p className="text-muted-foreground mb-12 max-w-2xl">
            Use the hosted API for instant access, or self-host for full data sovereignty. Camera feeds never leave your network when running on-prem — deploy anywhere from laptops to air-gapped facilities.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0, duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
            className="border border-foreground/[0.06] rounded-outer p-6 bg-foreground/[0.02]"
          >
            <div className="font-mono text-xs uppercase tracking-widest text-terminal-amber mb-3">Hosted API</div>
            <h3 className="font-display text-base font-medium mb-2">Zero setup</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Get an API key and start detecting in seconds. Object detection, depth estimation, and scene description — pay per call with credits.
            </p>
            <div className="font-mono text-xs bg-terminal-bg text-terminal-green px-3 py-2 rounded-inner border border-foreground/5 mt-3 overflow-x-auto">
              curl -X POST api.openeye.ai/v1/detect
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.05, duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
            className="border border-foreground/[0.06] rounded-outer p-6 bg-foreground/[0.02]"
          >
            <div className="font-mono text-xs uppercase tracking-widest text-terminal-green mb-3">Self-Hosted</div>
            <h3 className="font-display text-base font-medium mb-2">Air-gapped ready</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              All inference runs locally. No data leaves your premises — deploy in air-gapped environments, classified facilities, and on-device at the edge.
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1, duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
            className="border border-foreground/[0.06] rounded-outer p-6 bg-foreground/[0.02]"
          >
            <div className="font-mono text-xs uppercase tracking-widest text-terminal-green mb-3">Docker</div>
            <h3 className="font-display text-base font-medium mb-2">One command deploy</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              From zero to serving detections in 30 seconds. Multi-stage build with pre-pulled model weights and health checks built in.
            </p>
            <div className="font-mono text-xs bg-terminal-bg text-terminal-green px-3 py-2 rounded-inner border border-foreground/5 mt-3 overflow-x-auto">
              docker run -p 8000:8000 ghcr.io/openeye-ai/openeye serve
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15, duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
            className="border border-foreground/[0.06] rounded-outer p-6 bg-foreground/[0.02]"
          >
            <div className="font-mono text-xs uppercase tracking-widest text-terminal-green mb-3">Fleet</div>
            <h3 className="font-display text-base font-medium mb-2">Production at scale</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Manage hundreds of devices from a single dashboard. Canary deployments, rolling updates, real-time telemetry, and maintenance scheduling.
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
