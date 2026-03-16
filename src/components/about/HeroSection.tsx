import { motion } from "framer-motion";

const ease = [0.2, 0.8, 0.2, 1] as const;

export function HeroSection() {
  return (
    <section className="pt-28 pb-16 px-4">
      <div className="container max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease }}
        >
          <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">
            About
          </div>
          <h1 className="text-4xl md:text-5xl font-semibold font-display leading-[1.05] mb-4">
            Open-source eyes for every machine.
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl">
            OpenEye is created by venture studio{" "}
            <a
              href="https://aw3.technology"
              target="_blank"
              rel="noopener noreferrer"
              className="text-terminal-green hover:underline"
            >
              AW3 Technology
            </a>
            , building the open perception layer for robots and autonomous
            agents. We believe that as machines enter human spaces, the safety
            and vision systems they rely on must be transparent, inspectable,
            and community-owned.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
