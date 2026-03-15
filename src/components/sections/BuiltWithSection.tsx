import { motion } from "framer-motion";

const tools = ["Nebius Token Factory", "OpenRouter", "OpenClaw", "Hugging Face", "Solo CLI", "YOLOv8", "GroundingDINO", "Depth-Anything", "SAM2", "SmolVLA"];

export function BuiltWithSection() {
  return (
    <section className="py-[15vh] px-4">
      <div className="container max-w-6xl mx-auto text-center">
        <div className="flex items-center justify-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">
          <span className="w-2 h-2 rotate-45 bg-oe-blue" />
          <span className="w-2 h-2 rotate-45 bg-oe-red" />
          <span className="w-2 h-2 rotate-45 bg-foreground/40" />
          <span className="ml-1">Supported Models & Integrations</span>
        </div>
        <h2 className="text-3xl md:text-4xl font-semibold font-display mb-12">
          Open models. Open infrastructure.
        </h2>
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-3 font-mono text-sm text-muted-foreground">
          {tools.map((tool) => (
            <motion.span
              key={tool}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="px-4 py-2 border border-foreground/[0.06] rounded-inner hover:border-primary/20 transition-colors"
            >
              {tool}
            </motion.span>
          ))}
        </div>
      </div>
    </section>
  );
}
