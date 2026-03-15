import { motion } from "framer-motion";

const steps = [
  {
    step: "1",
    title: "Install OpenEye",
    command: "pip install openeye-ai",
    description: "Works with Python 3.10+. Installs the CLI, model adapters, and server.",
  },
  {
    step: "2",
    title: "Pull a model",
    command: "openeye pull yolov8",
    description: "Download model weights from the registry. Handles dependencies and runtime setup automatically.",
  },
  {
    step: "3",
    title: "Run your first detection",
    command: "openeye run yolov8 image.jpg",
    description: "Point any model at any image. Returns unified JSON with objects, bounding boxes, and confidence scores.",
  },
  {
    step: "4",
    title: "Start real-time monitoring",
    command: "openeye watch --models yolov8 --safety",
    description: "Connect a USB camera or RTSP stream. Live terminal HUD with detections, safety zones, and hazard alerts.",
  },
];

export function GetStarted() {
  return (
    <section id="get-started" className="py-[15vh] px-4 bg-card">
      <div className="container max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">
            Getting Started
          </div>
          <h2 className="text-3xl md:text-4xl font-semibold font-display mb-4">
            Up and running in minutes.
          </h2>
          <p className="text-muted-foreground mb-12 max-w-xl">
            From install to structured perception output in four commands. No GPU required for basic detection.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 gap-6">
          {steps.map((item, i) => (
            <motion.div
              key={item.step}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05, duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
              className="bg-background border border-foreground/[0.06] rounded-outer p-5"
            >
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-inner bg-terminal-green/10 border border-terminal-green/20 flex items-center justify-center flex-shrink-0">
                  <span className="font-mono text-sm text-terminal-green font-medium">{item.step}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-display text-base font-medium mb-2">{item.title}</h3>
                  <div className="font-mono text-sm bg-secondary text-oe-green px-3 py-2 rounded-inner border mb-3 overflow-x-auto">
                    $ {item.command}
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Serve API alternative */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2, duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
          className="mt-8 border border-terminal-amber/20 rounded-outer p-5 bg-terminal-amber/[0.03]"
        >
          <div className="flex items-start gap-4">
            <div className="w-8 h-8 rounded-inner bg-terminal-amber/10 border border-terminal-amber/20 flex items-center justify-center flex-shrink-0">
              <span className="font-mono text-sm text-terminal-amber font-medium">API</span>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-display text-base font-medium mb-2">Want an API? Start the server.</h3>
              <div className="font-mono text-xs sm:text-sm bg-terminal-bg text-terminal-green px-3 py-2 rounded-inner border border-foreground/5 mb-3 overflow-x-auto whitespace-nowrap">
                $ openeye serve yolov8 --port 8000
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Launches a FastAPI server with REST endpoints, WebSocket streaming, and a browser-based dashboard. Send images to <code className="text-terminal-green">POST /predict</code> and get back structured JSON.
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3, duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
          className="mt-10 text-center"
        >
          <div className="inline-flex flex-wrap gap-3">
            <a
              href="/docs"
              className="font-mono text-sm bg-foreground text-background px-5 py-2.5 rounded-inner hover:bg-foreground/90 transition-colors active:scale-[0.98]"
            >
              View Full Documentation
            </a>
            <div className="font-mono text-sm bg-terminal-bg text-terminal-green px-5 py-2.5 rounded-inner border border-foreground/5">
              pip install openeye-ai
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
