import { motion } from "framer-motion";

const ease = [0.2, 0.8, 0.2, 1] as const;

export function ModelSwapSection() {
  return (
    <section className="px-4 pb-16">
      <div className="container max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1, ease }}
          className="border border-foreground/[0.06] rounded-outer p-8 bg-foreground/[0.02]"
        >
          <div className="font-mono text-xs uppercase tracking-widest text-terminal-green mb-4">
            How It Works
          </div>
          <h2 className="text-2xl font-semibold font-display mb-4">
            Swap models from the CLI.
          </h2>
          <p className="text-muted-foreground mb-6 max-w-xl">
            The model adapter layer lets you switch between any supported model
            with a single flag. No code changes, no redeployment.
          </p>
          <div className="space-y-2">
            <div className="font-mono text-sm bg-secondary text-oe-green px-4 py-2.5 rounded-inner border">
              $ openeye run yolov8 image.jpg
            </div>
            <div className="font-mono text-sm bg-secondary text-oe-green px-4 py-2.5 rounded-inner border">
              $ openeye run grounding-dino image.jpg --prompt "red mug"
            </div>
            <div className="font-mono text-sm bg-secondary text-oe-green px-4 py-2.5 rounded-inner border">
              $ openeye run depth-anything scene.jpg
            </div>
            <div className="font-mono text-sm bg-secondary text-oe-green px-4 py-2.5 rounded-inner border">
              $ openeye run sam2 workspace.jpg --segment
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
