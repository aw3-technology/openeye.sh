import { motion } from "framer-motion";

interface TerminalLine {
  text: string;
  color?: "green" | "amber" | "red" | "muted" | "default";
  delay?: number;
}

interface TerminalBlockProps {
  lines: TerminalLine[];
  title?: string;
  animate?: boolean;
}

const colorMap = {
  green: "text-oe-green",
  amber: "text-primary",
  red: "text-oe-red",
  muted: "text-terminal-muted",
  default: "text-terminal-fg",
};

export function TerminalBlock({ lines, title, animate = true }: TerminalBlockProps) {
  const [visibleLines, setVisibleLines] = useState(animate ? 0 : lines.length);

  useEffect(() => {
    if (!animate) return;
    const interval = setInterval(() => {
      setVisibleLines((prev) => {
        if (prev >= lines.length) {
          clearInterval(interval);
          return prev;
        }
        return prev + 1;
      });
    }, 120);
    return () => clearInterval(interval);
  }, [lines.length, animate]);

  return (
    <div className="bg-card rounded-outer border border-foreground/[0.06] overflow-hidden shadow-lg">
      {/* Window chrome */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-foreground/[0.06]">
        <div className="w-2 h-2 rotate-45 bg-oe-blue" />
        <div className="w-2 h-2 rotate-45 bg-oe-red" />
        <div className="w-2 h-2 rotate-45 bg-foreground/40" />
        {title && (
          <span className="ml-2 text-xs font-mono text-muted-foreground uppercase tracking-widest">
            {title}
          </span>
        )}
      </div>
      {/* Content */}
      <div className="p-4 md:p-6 font-mono text-sm leading-relaxed space-y-0.5 min-h-[120px]">
        {lines.slice(0, visibleLines).map((line, i) => (
          <motion.div
            key={i}
            initial={animate ? { opacity: 0, x: -4 } : undefined}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.15, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <span className={colorMap[line.color || "default"]}>{line.text}</span>
          </motion.div>
        ))}
        {visibleLines < lines.length && (
          <span className="inline-block w-2 h-4 bg-oe-green animate-cursor-blink" />
        )}
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
