import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState, useRef } from "react";

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
  const [hasBeenVisible, setHasBeenVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();

  // Use IntersectionObserver to start animation only when visible
  useEffect(() => {
    if (!animate || hasBeenVisible) return;
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHasBeenVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [animate, hasBeenVisible]);

  // Run line-by-line animation once visible
  useEffect(() => {
    if (!animate || !hasBeenVisible) return;
    if (shouldReduceMotion) {
      setVisibleLines(lines.length);
      return;
    }

    setVisibleLines(0);
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
  }, [lines.length, animate, hasBeenVisible, shouldReduceMotion]);

  const animDuration = shouldReduceMotion ? 0 : 0.15;

  return (
    <div ref={containerRef} className="bg-card rounded-outer border border-foreground/[0.06] overflow-hidden shadow-lg">
      {/* Window chrome — diamond dots */}
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
            initial={animate && !shouldReduceMotion ? { opacity: 0, x: -4 } : undefined}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: animDuration, ease: [0.2, 0.8, 0.2, 1] }}
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
