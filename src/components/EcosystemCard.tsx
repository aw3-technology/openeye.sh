import { motion } from "framer-motion";

interface EcosystemCardProps {
  name: string;
  creator: string;
  description: string;
  integrated?: boolean;
}

export function EcosystemCard({ name, creator, description, integrated }: EcosystemCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
      className="bg-card border rounded-inner p-3 flex flex-col gap-1"
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-mono text-sm text-terminal-green font-medium truncate min-w-0">{name}</span>
        {integrated && (
          <span className="font-mono text-[9px] uppercase tracking-wider bg-terminal-green/15 text-terminal-green px-1.5 py-0.5 rounded-sm whitespace-nowrap">
            Integrated
          </span>
        )}
      </div>
      <div className="font-mono text-[11px] text-terminal-muted">{creator}</div>
      <div className="text-xs text-muted-foreground leading-relaxed">{description}</div>
    </motion.div>
  );
}
