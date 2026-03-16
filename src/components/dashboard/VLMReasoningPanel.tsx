import { useEffect, useState, useRef } from "react";
import { usePerceptionStream } from "@/hooks/usePerceptionStream";
import { useVLMStream } from "@/hooks/useVLMStream";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, Eye, Layers } from "lucide-react";
import { motion } from "framer-motion";
import type { VLMReasoning } from "@/types/openeye";

export function VLMReasoningPanel() {
  const { videoRef, isStreaming } = usePerceptionStream();
  const { latestReasoning, isActive, isPending, latencyMs, start, stop } = useVLMStream();
  const [displayText, setDisplayText] = useState("");
  const [history, setHistory] = useState<VLMReasoning[]>([]);
  const animRef = useRef<number | null>(null);
  const targetRef = useRef("");

  // Auto-start/stop VLM with main stream
  useEffect(() => {
    if (isStreaming && !isActive) start(videoRef);
    if (!isStreaming && isActive) stop();
  }, [isStreaming, isActive, start, stop, videoRef]);

  // Typewriter effect
  useEffect(() => {
    if (!latestReasoning?.description) return;
    const text = latestReasoning.description;

    setHistory((prev) => {
      const next = [latestReasoning, ...prev.filter((v) => v.description !== text)];
      return next.slice(0, 3);
    });

    targetRef.current = text;
    let charIndex = 0;
    setDisplayText("");

    const tick = () => {
      if (charIndex < targetRef.current.length) {
        charIndex += 2;
        setDisplayText(targetRef.current.slice(0, charIndex));
        animRef.current = requestAnimationFrame(tick);
      }
    };
    animRef.current = requestAnimationFrame(tick);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [latestReasoning]);

  return (
    <Card className="border-foreground/10 bg-card/50 backdrop-blur-sm overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-3.5 w-3.5 text-purple-400" />
            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider">
              VLM Reasoning
            </CardTitle>
            <Badge
              variant="outline"
              className="text-[9px] font-mono border-purple-500/30 text-purple-400"
            >
              Dual-Layer
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {isPending && (
              <span className="flex items-center gap-1.5 text-[10px] font-mono text-purple-400">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500" />
                </span>
                Thinking...
              </span>
            )}
            {latencyMs > 0 && (
              <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                {(latencyMs / 1000).toFixed(1)}s
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="font-mono text-xs leading-relaxed max-h-[220px] overflow-y-auto space-y-3">
          {!isStreaming ? (
            <p className="text-muted-foreground">Start camera to enable VLM reasoning.</p>
          ) : latestReasoning ? (
            <>
              {/* Current description with typewriter */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Eye className="h-3 w-3 text-purple-400" />
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    Scene
                  </span>
                </div>
                <div className="text-terminal-green bg-foreground/5 rounded-md p-2.5 border border-foreground/5">
                  {displayText}
                  {displayText.length < (targetRef.current?.length ?? 0) && (
                    <span className="inline-block w-1.5 h-3 bg-terminal-green animate-[cursor-blink_1s_step-end_infinite] ml-0.5" />
                  )}
                </div>
              </div>

              {/* Reasoning */}
              {latestReasoning.reasoning && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Brain className="h-3 w-3 text-purple-400" />
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      Reasoning
                    </span>
                  </div>
                  <p className="text-foreground/80 bg-foreground/5 rounded-md p-2.5 border border-foreground/5">
                    {latestReasoning.reasoning}
                  </p>
                </div>
              )}

              {/* History */}
              {history.slice(1).map((vlm, i) => (
                <motion.div
                  key={`hist-${i}`}
                  initial={{ opacity: 0.4 }}
                  animate={{ opacity: 0.25 - i * 0.08 }}
                  className="text-muted-foreground border-t border-foreground/5 pt-2"
                >
                  <span className="text-[10px] tabular-nums">
                    [{(vlm.latency_ms / 1000).toFixed(1)}s]
                  </span>{" "}
                  {vlm.description.slice(0, 100)}
                  {vlm.description.length > 100 ? "..." : ""}
                </motion.div>
              ))}
            </>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500" />
              </span>
              Waiting for first VLM response...
            </div>
          )}

          {/* Pipeline info */}
          {isStreaming && (
            <div className="flex items-center gap-4 pt-1 border-t border-foreground/5">
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <Layers className="h-3 w-3" />
                <span>YOLO + VLM</span>
              </div>
              <Badge
                variant="outline"
                className="text-[9px] font-mono border-blue-500/30 text-blue-400"
              >
                Nebius
              </Badge>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
