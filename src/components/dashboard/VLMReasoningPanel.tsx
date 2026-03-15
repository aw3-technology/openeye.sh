import { usePerceptionStream } from "@/hooks/usePerceptionStream";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import type { VLMReasoning } from "@/types/openeye";

export function VLMReasoningPanel() {
  const { latestVLM, vlmLoading } = usePerceptionStream();
  const [displayText, setDisplayText] = useState("");
  const [history, setHistory] = useState<VLMReasoning[]>([]);
  const animRef = useRef<number | null>(null);
  const targetRef = useRef("");

  // Typewriter effect
  useEffect(() => {
    if (!latestVLM?.description) return;
    const text = latestVLM.description;

    // Add to history (keep last 3)
    setHistory((prev) => {
      const next = [latestVLM, ...prev.filter((v) => v.description !== text)];
      return next.slice(0, 3);
    });

    targetRef.current = text;
    let charIndex = 0;
    setDisplayText("");

    const tick = () => {
      if (charIndex < targetRef.current.length) {
        charIndex += 2; // 2 chars per frame for speed
        setDisplayText(targetRef.current.slice(0, charIndex));
        animRef.current = requestAnimationFrame(tick);
      }
    };
    animRef.current = requestAnimationFrame(tick);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [latestVLM]);

  return (
    <div className="bg-terminal-bg rounded-outer border border-foreground/5 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-foreground/5">
        <span className="font-mono text-xs text-terminal-muted uppercase tracking-widest">
          VLM Reasoning
        </span>
        <div className="flex items-center gap-2">
          {vlmLoading && (
            <Loader2 className="w-3 h-3 text-terminal-amber animate-spin" />
          )}
          {latestVLM && (
            <span className="font-mono text-[10px] text-terminal-muted tabular-nums">
              {(latestVLM.latency_ms / 1000).toFixed(1)}s
            </span>
          )}
        </div>
      </div>
      <div className="p-4 font-mono text-xs leading-relaxed max-h-[240px] overflow-y-auto space-y-3">
        {/* Latest (with typewriter) */}
        {latestVLM ? (
          <div className="text-terminal-green">
            {displayText}
            {displayText.length < (targetRef.current?.length ?? 0) && (
              <span className="inline-block w-1.5 h-3 bg-terminal-green animate-cursor-blink ml-0.5" />
            )}
          </div>
        ) : vlmLoading ? (
          <div className="text-terminal-muted flex items-center gap-2">
            <Loader2 className="w-3 h-3 animate-spin" />
            Analyzing frame...
          </div>
        ) : (
          <div className="text-terminal-muted">
            Waiting for VLM analysis...
            <span className="inline-block w-1.5 h-3 bg-terminal-green animate-cursor-blink ml-0.5" />
          </div>
        )}

        {/* History (older entries, faded) */}
        {history.slice(1).map((vlm, i) => (
          <motion.div
            key={`hist-${i}`}
            initial={{ opacity: 0.5 }}
            animate={{ opacity: 0.3 - i * 0.1 }}
            className="text-terminal-muted border-t border-foreground/5 pt-2"
          >
            <span className="text-[10px] tabular-nums">
              [{(vlm.latency_ms / 1000).toFixed(1)}s]
            </span>{" "}
            {vlm.description.slice(0, 120)}
            {vlm.description.length > 120 ? "..." : ""}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
