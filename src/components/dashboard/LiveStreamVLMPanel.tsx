import { useEffect } from "react";
import { useOpenEyeStream } from "@/hooks/useOpenEyeStream";
import { useVLMStream } from "@/hooks/useVLMStream";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, Clock, Eye, Layers } from "lucide-react";

export function LiveStreamVLMPanel() {
  const { videoRef, isStreaming } = useOpenEyeStream();
  const { latestReasoning, isActive, isPending, latencyMs, start, stop } = useVLMStream();

  // Auto-start VLM when the main stream starts, auto-stop when it stops
  useEffect(() => {
    if (isStreaming && !isActive) {
      start(videoRef);
    }
    if (!isStreaming && isActive) {
      stop();
    }
  }, [isStreaming, isActive, start, stop, videoRef]);

  return (
    <Card className="border-foreground/10 bg-card/50 backdrop-blur-sm overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-purple-400" />
            <CardTitle className="text-sm">VLM Reasoning</CardTitle>
            <Badge
              variant="outline"
              className="text-[10px] font-mono border-purple-500/30 text-purple-400"
            >
              Dual-Layer Perception
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="text-[10px] font-mono border-blue-500/30 text-blue-400"
            >
              Nebius Token Factory
            </Badge>
            {isPending && (
              <span className="flex items-center gap-1.5 text-[10px] font-mono text-purple-400">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500" />
                </span>
                Reasoning...
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!isStreaming ? (
          <p className="text-sm text-muted-foreground font-mono">
            Start camera to enable VLM reasoning.
          </p>
        ) : !latestReasoning ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500" />
              </span>
              <span className="font-mono text-xs">Waiting for first VLM response...</span>
            </div>
            <div className="h-16 rounded-md bg-foreground/5 animate-pulse" />
          </div>
        ) : (
          <div className="space-y-3">
            {/* VLM Description */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Eye className="h-3 w-3 text-purple-400" />
                <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                  Scene Description
                </span>
              </div>
              <p className="text-sm leading-relaxed text-foreground/90 font-mono bg-foreground/5 rounded-md p-3 border border-foreground/5">
                {latestReasoning.description}
              </p>
            </div>

            {/* VLM Reasoning */}
            {latestReasoning.reasoning && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Brain className="h-3 w-3 text-purple-400" />
                  <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                    Reasoning
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-foreground/80 font-mono bg-foreground/5 rounded-md p-3 border border-foreground/5">
                  {latestReasoning.reasoning}
                </p>
              </div>
            )}

            {/* VLM Latency */}
            <div className="flex items-center gap-4 pt-1 border-t border-foreground/5">
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>VLM Latency:</span>
                <span
                  className={`font-semibold tabular-nums ${
                    latencyMs < 2000 ? "text-terminal-green" : latencyMs < 5000 ? "text-terminal-amber" : "text-red-400"
                  }`}
                >
                  {latencyMs.toFixed(0)}ms
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground">
                <Layers className="h-3 w-3" />
                <span>Pipeline:</span>
                <span className="text-terminal-green font-semibold">YOLO + VLM</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
