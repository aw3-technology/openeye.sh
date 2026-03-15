import { motion } from "framer-motion";
import { SafetyDemo } from "@/components/SafetyDemo";

export function SafetyGuardianSection() {
  return (
    <section id="safety" className="py-[15vh] px-4 bg-card">
      <div className="container max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <div className="font-mono text-xs uppercase tracking-widest text-terminal-red mb-4">
            Use Case — Safety Guardian
          </div>
          <h2 className="text-3xl md:text-4xl font-semibold font-display mb-4">
            Who watches the robots?
          </h2>
          <p className="text-muted-foreground mb-4 max-w-2xl">
            As robots enter homes and workplaces, OpenEye acts as a visual safety layer — monitoring any robot's workspace in real-time and intervening before accidents happen. Watch the demo below cycle through a live safety scenario.
          </p>
          <div className="font-mono text-sm bg-card text-oe-green px-4 py-2.5 rounded-inner border border-border inline-block mb-12">
            $ openeye watch --safety --danger-m 0.5 --caution-m 1.5
          </div>
        </motion.div>

        <SafetyDemo />

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.3, delay: 0.1, ease: [0.2, 0.8, 0.2, 1] }}
          className="mt-12 grid sm:grid-cols-3 gap-6"
        >
          <div className="space-y-2">
            <div className="font-mono text-xs uppercase tracking-widest text-terminal-green">Fast Layer</div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              YOLOv8 runs every frame for real-time detection. Pure geometry — is a hand inside the danger zone? Low-latency halt with no LLM overhead.
            </p>
          </div>
          <div className="space-y-2">
            <div className="font-mono text-xs uppercase tracking-widest text-terminal-amber">Smart Layer</div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              A VLM analyzes periodically for contextual understanding. Catches what YOLO can't — a knife that wasn't there before, an unstable stack, context-dependent risks.
            </p>
          </div>
          <div className="space-y-2">
            <div className="font-mono text-xs uppercase tracking-widest text-terminal-red">Halt Protocol</div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              When danger is detected, OpenEye sends a halt signal to the connected robot controller. Operations resume only when the workspace is confirmed clear.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
