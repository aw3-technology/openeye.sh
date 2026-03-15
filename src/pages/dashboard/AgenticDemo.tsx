import { useOpenEyeStream } from "@/hooks/useOpenEyeStream";
import { LiveCameraFeed } from "@/components/dashboard/LiveCameraFeed";
import { AgenticLoop } from "@/components/dashboard/AgenticLoop";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Square, Brain } from "lucide-react";
import { toast } from "sonner";

function AgenticDemoInner() {
  const { isStreaming, startStream, stopStream, videoRef } = useOpenEyeStream();

  const handleStart = async () => {
    try {
      await startStream();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start camera");
    }
  };

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
            Demo
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

      {/* Camera Feed */}
      <div className="relative">
        <LiveCameraFeed />

        {/* Agentic overlay on camera */}
        {isStreaming && (
          <div className="absolute top-3 right-3 font-mono text-[10px] text-terminal-amber/80 bg-background/70 backdrop-blur px-2 py-1 rounded">
            <div className="flex items-center gap-1.5">
              <Brain className="h-3 w-3" />
              AGENTIC MODE
            </div>
          </div>
        )}
      </div>

      {/* Agentic Loop Panel */}
      <AgenticLoop videoRef={videoRef} isStreaming={isStreaming} />
    </div>
  );
}

export default function AgenticDemo() {
  return <AgenticDemoInner />;
}
