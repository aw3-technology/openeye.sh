import { useCallback } from "react";
import { OpenEyeStreamProvider, useOpenEyeStream } from "@/hooks/useOpenEyeStream";
import { useOpenEyeConnection } from "@/hooks/useOpenEyeConnection";
import { LiveCameraFeed } from "@/components/dashboard/LiveCameraFeed";
import { LiveSceneGraph } from "@/components/dashboard/LiveSceneGraph";
import { DetectionList } from "@/components/dashboard/DetectionList";
import { VLMReasoningPanel } from "@/components/dashboard/VLMReasoningPanel";
import { SafetyLog } from "@/components/dashboard/SafetyLog";
import { ModelSettingsPanel } from "@/components/dashboard/ModelSettingsPanel";
import { MetricsBar } from "@/components/dashboard/MetricsBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Play,
  Square,
  Maximize2,
  Wifi,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";

/* ------------------------------------------------------------------ */
/*  Main LiveStream Inner Component                                    */
/* ------------------------------------------------------------------ */

function LiveStreamInner() {
  const { isStreaming, startStream, stopStream, latestResult } = useOpenEyeStream();
  const { isConnected, healthData } = useOpenEyeConnection();

  const handleStart = async () => {
    try {
      await startStream();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start camera");
    }
  };

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }, []);

  const objects = latestResult?.objects ?? [];

  return (
    <div className="space-y-4">
      {/* ---- Header ---- */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">Live Stream</h1>
          {isStreaming && (
            <Badge
              variant="outline"
              className="text-[10px] font-mono border-terminal-green/30 text-terminal-green animate-pulse"
            >
              LIVE
            </Badge>
          )}
          {/* Connection status */}
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground">
            {isConnected ? (
              <Wifi className="h-3 w-3 text-terminal-green" />
            ) : (
              <WifiOff className="h-3 w-3 text-red-400" />
            )}
            <span className="hidden sm:inline">
              {isConnected
                ? healthData?.model ?? "connected"
                : "disconnected"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={toggleFullscreen}
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
          <Button
            onClick={isStreaming ? stopStream : handleStart}
            variant={isStreaming ? "destructive" : "default"}
            className="gap-2"
          >
            {isStreaming ? (
              <>
                <Square className="h-4 w-4" />
                Stop
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Start Camera
              </>
            )}
          </Button>
        </div>
      </div>

      {/* ---- Main Layout: 60/40 ---- */}
      <div className="grid lg:grid-cols-5 gap-4">
        {/* Left column: Camera Feed */}
        <div className="lg:col-span-3 space-y-4">
          <LiveCameraFeed />
          {/* Metrics bar below camera */}
          <MetricsBar />
        </div>

        {/* Right column: Intelligence Panels */}
        <div className="lg:col-span-2 flex flex-col gap-3">
          <DetectionList />
          <SafetyLog isStreaming={isStreaming} objects={objects} />
          <LiveSceneGraph objects={objects} />
        </div>
      </div>

      {/* ---- Bottom panels ---- */}
      <div className="grid gap-4 lg:grid-cols-2">
        <VLMReasoningPanel />
        <ModelSettingsPanel />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Exported Page Component                                            */
/* ------------------------------------------------------------------ */

export default function LiveStream() {
  return (
    <OpenEyeStreamProvider>
      <LiveStreamInner />
    </OpenEyeStreamProvider>
  );
}
