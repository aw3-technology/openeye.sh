import { motion } from "framer-motion";

interface CommandCardProps {
  label: string;
  command: string;
  description: string;
}

export function CommandCard({ label, command, description }: CommandCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
      whileTap={{ scale: 0.98 }}
      className="bg-card rounded-outer border border-foreground/[0.06] p-6 hover:shadow-md transition-shadow cursor-default"
    >
      <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground mb-3">
        {label}
      </div>
      <div className="font-mono text-sm text-terminal-green bg-terminal-bg rounded-inner px-3 py-2 mb-3">
        $ {command}
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </motion.div>
  );
}
