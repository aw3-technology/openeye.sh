import { PerceptionStreamProvider, usePerceptionStream } from "@/hooks/usePerceptionStream";
import { DemoFeed } from "@/components/dashboard/DemoFeed";
import { SafetyPanel } from "@/components/dashboard/SafetyPanel";
import { DemoSceneGraph } from "@/components/dashboard/DemoSceneGraph";
import { VLMReasoningPanel } from "@/components/dashboard/VLMReasoningPanel";
import { ActionPlanPanel } from "@/components/dashboard/ActionPlanPanel";
import { Camera, Square, Circle, Play, Maximize2 } from "lucide-react";
import { useState } from "react";

function DemoControls() {
  const {
    isStreaming,
    mode,
    isRecording,
    metrics,
    latestVLM,
    overallSafetyState,
    startStream,
    stopStream,
    startRecording,
    stopRecording,
    startReplay,
    stopReplay,
  } = usePerceptionStream();
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Stream controls */}
      {mode === "idle" || mode === "replay" ? (
        <button
          onClick={() => {
            if (mode === "replay") stopReplay();
            startStream();
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-terminal-green/10 border border-terminal-green/30 rounded-inner font-mono text-xs text-terminal-green hover:bg-terminal-green/20 transition-colors"
        >
          <Camera className="w-3.5 h-3.5" />
          Start
        </button>
      ) : (
        <button
          onClick={stopStream}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-terminal-red/10 border border-terminal-red/30 rounded-inner font-mono text-xs text-terminal-red hover:bg-terminal-red/20 transition-colors"
        >
          <Square className="w-3 h-3" />
          Stop
        </button>
      )}

      {/* Record controls */}
      {isStreaming && !isRecording && (
        <button
          onClick={startRecording}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-terminal-red/10 border border-terminal-red/30 rounded-inner font-mono text-xs text-terminal-red hover:bg-terminal-red/20 transition-colors"
        >
          <Circle className="w-3 h-3 fill-terminal-red" />
          Record
        </button>
      )}
      {isRecording && (
        <button
          onClick={stopRecording}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-terminal-red/20 border border-terminal-red/50 rounded-inner font-mono text-xs text-terminal-red animate-pulse hover:bg-terminal-red/30 transition-colors"
        >
          <Square className="w-3 h-3 fill-terminal-red" />
          Stop Rec
        </button>
      )}

      {/* Replay */}
      {mode !== "replay" && !isStreaming && (
        <button
          onClick={startReplay}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-terminal-amber/10 border border-terminal-amber/30 rounded-inner font-mono text-xs text-terminal-amber hover:bg-terminal-amber/20 transition-colors"
        >
          <Play className="w-3.5 h-3.5" />
          Replay
        </button>
      )}
      {mode === "replay" && (
        <button
          onClick={stopReplay}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-terminal-amber/10 border border-terminal-amber/30 rounded-inner font-mono text-xs text-terminal-amber hover:bg-terminal-amber/20 transition-colors"
        >
          <Square className="w-3 h-3" />
          Stop Replay
        </button>
      )}

      {/* Fullscreen */}
      <button
        onClick={toggleFullscreen}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-foreground/5 border border-foreground/10 rounded-inner font-mono text-xs text-terminal-muted hover:bg-foreground/10 transition-colors ml-auto"
      >
        <Maximize2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function MetricsBar() {
  const { metrics, overallSafetyState, latestFrame, latestVLM } = usePerceptionStream();

  const safetyColor =
    overallSafetyState === "danger"
      ? "text-terminal-red"
      : overallSafetyState === "caution"
      ? "text-terminal-amber"
      : "text-terminal-green";

  return (
    <div className="grid grid-cols-5 gap-2">
      {[
        { label: "FPS", value: String(metrics.fps) },
        { label: "Latency", value: `${metrics.latency_ms.toFixed(0)}ms` },
        { label: "Objects", value: String(latestFrame?.objects.length ?? 0) },
        {
          label: "Safety",
          value: overallSafetyState.toUpperCase(),
          className: safetyColor,
        },
        {
          label: "VLM",
          value: latestVLM ? `${(latestVLM.latency_ms / 1000).toFixed(1)}s` : "—",
        },
      ].map((stat) => (
        <div
          key={stat.label}
          className="bg-card rounded-inner border px-3 py-2 text-center"
        >
          <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
            {stat.label}
          </div>
          <div
            className={`font-mono text-sm tabular-nums ${
              stat.className ?? "text-terminal-green"
            }`}
          >
            {stat.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function DemoContent() {
  return (
    <div className="space-y-4">
      {/* Controls */}
      <DemoControls />

      {/* Main layout: 60/40 */}
      <div className="grid lg:grid-cols-5 gap-4">
        {/* Left: Camera feed */}
        <div className="lg:col-span-3">
          <DemoFeed />
        </div>

        {/* Right: Intelligence panels */}
        <div className="lg:col-span-2 flex flex-col gap-3">
          <SafetyPanel />
          <DemoSceneGraph />
          <VLMReasoningPanel />
          <ActionPlanPanel />
        </div>
      </div>

      {/* Bottom: Metrics bar */}
      <MetricsBar />
    </div>
  );
}

export default function Demo() {
  return (
    <PerceptionStreamProvider>
      <DemoContent />
    </PerceptionStreamProvider>
  );
}
