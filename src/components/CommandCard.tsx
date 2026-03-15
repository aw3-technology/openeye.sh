import { motion } from "framer-motion";
import { ease } from "@/lib/motion";

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
      transition={{ duration: 0.3, ease }}
      whileTap={{ scale: 0.98 }}
      className="bg-card rounded-outer border border-foreground/[0.06] p-6 hover:border-primary/20 hover:shadow-md transition-all cursor-default"
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="w-2 h-2 rotate-45 bg-oe-blue" />
        <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="font-mono text-sm text-oe-green bg-background rounded-inner px-3 py-2 mb-3 border border-foreground/[0.04]">
        $ {command}
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </motion.div>
  );
}
