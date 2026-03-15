import { motion } from "framer-motion";

const tools = ["Nebius Token Factory", "OpenRouter", "OpenClaw", "Hugging Face", "Solo CLI", "YOLOv8", "GroundingDINO", "Depth-Anything", "SAM2", "SmolVLA"];

export function BuiltWithSection() {
  return (
    <section className="py-[15vh] px-4">
      <div className="container max-w-6xl mx-auto text-center">
        <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">
          Supported Models & Integrations
        </div>
        <h2 className="text-3xl md:text-4xl font-semibold font-display mb-12">
          Open models. Open infrastructure.
        </h2>
        <div className="flex flex-wrap justify-center gap-x-8 gap-y-4 font-mono text-sm text-muted-foreground">
          {tools.map((tool) => (
            <motion.span
              key={tool}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="px-4 py-2 border border-foreground/[0.06] rounded-inner"
            >
              {tool}
            </motion.span>
          ))}
        </div>
      </div>
    </section>
  );
}
