import { motion } from "framer-motion";
import { ease } from "@/lib/motion";

export function DeployAnywhereSection() {
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
            Deploy Anywhere
          </div>
          <h2 className="text-3xl md:text-4xl font-semibold font-display mb-4">
            Your cameras. Your hardware. Your data.
          </h2>
          <p className="text-muted-foreground mb-12 max-w-2xl">
            Self-host for full data sovereignty, or use Docker for quick deployment. Camera feeds never leave your network when running on-prem — deploy anywhere from laptops to air-gapped facilities.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0, duration: 0.2, ease }}
            className="border border-foreground/[0.06] rounded-outer p-6 bg-foreground/[0.02]"
          >
            <div className="font-mono text-xs uppercase tracking-widest text-terminal-green mb-3">Self-Hosted</div>
            <h3 className="font-display text-base font-medium mb-2">Full data sovereignty</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              All inference runs locally. No data leaves your premises — run in air-gapped environments or on-device at the edge.
            </p>
            <div className="font-mono text-xs bg-secondary text-oe-green px-3 py-2 rounded-inner border mt-3 overflow-x-auto">
              openeye serve yolov8 --port 8000
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.05, duration: 0.2, ease }}
            className="border border-foreground/[0.06] rounded-outer p-6 bg-foreground/[0.02]"
          >
            <div className="font-mono text-xs uppercase tracking-widest text-terminal-green mb-3">REST + WebSocket</div>
            <h3 className="font-display text-base font-medium mb-2">API-first architecture</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              FastAPI server with REST endpoints for image inference, WebSocket streams for real-time feeds, and a built-in browser dashboard.
            </p>
            <div className="font-mono text-xs bg-secondary text-oe-green px-3 py-2 rounded-inner border mt-3 overflow-x-auto">
              curl -X POST localhost:8000/predict -F "file=@photo.jpg"
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1, duration: 0.2, ease }}
            className="border border-foreground/[0.06] rounded-outer p-6 bg-foreground/[0.02]"
          >
            <div className="font-mono text-xs uppercase tracking-widest text-terminal-green mb-3">Docker</div>
            <h3 className="font-display text-base font-medium mb-2">One command deploy</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              From zero to serving detections in 30 seconds. Multi-stage build with pre-pulled model weights and health checks built in.
            </p>
            <div className="font-mono text-xs bg-secondary text-oe-green px-3 py-2 rounded-inner border mt-3 overflow-x-auto">
              docker run -p 8000:8000 ghcr.io/openeye-ai/openeye serve
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15, duration: 0.2, ease }}
            className="border border-foreground/[0.06] rounded-outer p-6 bg-foreground/[0.02]"
          >
            <div className="font-mono text-xs uppercase tracking-widest text-terminal-green mb-3">Fleet</div>
            <h3 className="font-display text-base font-medium mb-2">Multi-device management</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Register and monitor edge devices from the CLI. Canary deployments, rolling updates, and device configuration built in.
            </p>
            <div className="font-mono text-xs bg-secondary text-oe-green px-3 py-2 rounded-inner border mt-3 overflow-x-auto">
              openeye fleet deploy --strategy canary
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
