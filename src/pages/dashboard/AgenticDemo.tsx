import { useState, useCallback } from "react";
import { OpenEyeStreamProvider, useOpenEyeStream } from "@/hooks/useOpenEyeStream";
import { LiveCameraFeed } from "@/components/dashboard/LiveCameraFeed";
import { AgenticLoop, type AgenticDetection } from "@/components/dashboard/AgenticLoop";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Square, Brain } from "lucide-react";
import { toast } from "sonner";

function AgenticDemoInner() {
  const { isStreaming, startStream, stopStream, videoRef } = useOpenEyeStream();
  const [agenticDetections, setAgenticDetections] = useState<AgenticDetection[]>([]);
  const [agentRunning, setAgentRunning] = useState(false);

  const handleStart = async () => {
    try {
      await startStream();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start camera");
    }
  };

  const handleDetections = useCallback((detections: AgenticDetection[]) => {
    setAgenticDetections(detections);
  }, []);

  const handleRunningChange = useCallback((running: boolean) => {
    setAgentRunning(running);
    if (!running) setAgenticDetections([]);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Brain className="h-6 w-6 text-terminal-green" />
            Agentic Loop
          </h1>
          <Badge
            variant="outline"
            className="text-[10px] font-mono uppercase tracking-wider border-terminal-green/30 text-terminal-green"
          >
            Perception + Reasoning + Action
          </Badge>
        </div>
        <Button
          onClick={isStreaming ? stopStream : handleStart}
          variant={isStreaming ? "destructive" : "default"}
          className={`gap-2 ${!isStreaming ? "bg-terminal-green hover:bg-terminal-green/80 text-primary-foreground" : ""}`}
        >
          {isStreaming ? (
            <>
              <Square className="h-4 w-4" />
              Stop Camera
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              Start Camera
            </>
          )}
        </Button>
      </div>

      {/* Subtitle */}
      <p className="text-sm text-muted-foreground -mt-4">
        Continuous perception-reasoning-action loop. YOLO detection runs every frame (&lt;100ms),
        VLM reasoning runs every 3 seconds, and the action planner synthesizes both into a coherent plan.
      </p>

      {/* Camera Feed with agentic detection overlays */}
      <div className="relative rounded-lg overflow-hidden">
        <LiveCameraFeed />

        {/* Agentic detection bounding boxes */}
        {agentRunning && agenticDetections.length > 0 && (
          <div className="absolute inset-0 pointer-events-none">
            {agenticDetections.map((det) => {
              const x = "x" in det.bbox ? det.bbox.x : det.bbox.x1;
              const y = "y" in det.bbox ? det.bbox.y : det.bbox.y1;
              const w = "w" in det.bbox ? det.bbox.w : det.bbox.x2 - det.bbox.x1;
              const h = "h" in det.bbox ? det.bbox.h : det.bbox.y2 - det.bbox.y1;
              const isManipulable = det.is_manipulable;
              const borderColor = isManipulable
                ? "border-terminal-amber"
                : "border-terminal-green";
              const bgColor = isManipulable
                ? "bg-terminal-amber/10"
                : "bg-terminal-green/10";
              const labelBg = isManipulable
                ? "bg-terminal-amber text-primary-foreground"
                : "bg-terminal-green text-primary-foreground";

              return (
                <div
                  key={det.track_id}
                  className="absolute"
                  style={{
                    left: `${x * 100}%`,
                    top: `${y * 100}%`,
                    width: `${w * 100}%`,
                    height: `${h * 100}%`,
                  }}
                >
                  <div className={`w-full h-full border ${borderColor} ${bgColor}`} />
                  <span
                    className={`absolute -top-5 left-0 text-[10px] font-mono font-semibold px-1.5 py-0.5 tabular-nums whitespace-nowrap ${labelBg}`}
                  >
                    {det.label} [{(det.confidence * 100).toFixed(0)}%]
                  </span>
                  {/* Track ID */}
                  <span className="absolute -top-5 right-0 text-[9px] font-mono px-1 py-0.5 bg-black/60 text-white/70">
                    #{det.track_id}
                  </span>
                  {/* Corner brackets */}
                  <div className={`absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 ${borderColor}`} />
                  <div className={`absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 ${borderColor}`} />
                  <div className={`absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 ${borderColor}`} />
                  <div className={`absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 ${borderColor}`} />
                </div>
              );
            })}
          </div>
        )}

        {/* Agentic mode overlay badge */}
        {isStreaming && (
          <div className="absolute top-3 right-3 font-mono text-[10px] pointer-events-none">
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded backdrop-blur ${
              agentRunning
                ? "bg-terminal-amber/20 border border-terminal-amber/30 text-terminal-amber"
                : "bg-background/70 text-muted-foreground"
            }`}>
              <Brain className="h-3 w-3" />
              {agentRunning ? "AGENTIC MODE" : "CAMERA ONLY"}
              {agentRunning && (
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-terminal-amber opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-terminal-amber" />
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Agentic Loop Panel */}
      <AgenticLoop
        videoRef={videoRef}
        isStreaming={isStreaming}
        onDetections={handleDetections}
        onRunningChange={handleRunningChange}
      />
    </div>
  );
}

export default function AgenticDemo() {
  return (
    <OpenEyeStreamProvider>
      <AgenticDemoInner />
    </OpenEyeStreamProvider>
  );
}
