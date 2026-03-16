import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { OpenEyeConnectionProvider, useOpenEyeConnection } from "@/hooks/useOpenEyeConnection";
import { OpenEyeStreamProvider, useOpenEyeStream } from "@/hooks/useOpenEyeStream";
import { useVLMStream } from "@/hooks/useVLMStream";
import { OpenEyeWebSocket } from "@/lib/openeye-ws";
import { LiveCameraFeed } from "@/components/dashboard/LiveCameraFeed";

import type { AgenticFrame, NebiusStats } from "./hackathon-demo/constants";
import { detectPhase } from "./hackathon-demo/constants";
import { useTypewriter } from "./hackathon-demo/useTypewriter";
import { HackathonHeader } from "./hackathon-demo/HackathonHeader";
import { SafetyBadge } from "./hackathon-demo/SafetyBadge";
import { DetectionOverlay } from "./hackathon-demo/DetectionOverlay";
import { IntelligencePanel } from "./hackathon-demo/IntelligencePanel";
import { BottomBar } from "./hackathon-demo/BottomBar";

function HackathonDemoInner() {
  const { serverUrl, isConnected, client } = useOpenEyeConnection();
  const { isStreaming, startStream, videoRef, latestResult, metrics } =
    useOpenEyeStream();
  const vlm = useVLMStream();

  // Agentic state
  const [agenticFrame, setAgenticFrame] = useState<AgenticFrame | null>(null);
  const [goal, setGoal] = useState("Observe and describe the environment");
  const [goalInput, setGoalInput] = useState(
    "Observe and describe the environment",
  );
  const goalRef = useRef(goal);
  const wsRef = useRef<OpenEyeWebSocket | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Nebius stats
  const [nebiusStats, setNebiusStats] = useState<NebiusStats | null>(null);

  // Timeline events
  const [events, setEvents] = useState<
    Array<{ time: number; text: string; type: string }>
  >([]);

  // VLM typewriter
  const vlmText = vlm.latestReasoning?.description || "";
  const { displayed: vlmDisplayed, isTyping: vlmTyping } = useTypewriter(
    vlmText,
    15,
  );

  // Phase detection
  const hasDanger = useMemo(
    () =>
      agenticFrame?.safety_alerts?.some((a) => a.halt_recommended) ?? false,
    [agenticFrame],
  );

  const phase = useMemo(
    () =>
      detectPhase(
        isStreaming,
        !!vlm.latestReasoning?.description,
        !!goal,
        hasDanger,
      ),
    [isStreaming, vlm.latestReasoning, goal, hasDanger],
  );

  const safetyLevel: "SAFE" | "CAUTION" | "DANGER" = hasDanger
    ? "DANGER"
    : (agenticFrame?.safety_alerts?.length ?? 0) > 0
      ? "CAUTION"
      : "SAFE";

  // Auto-start camera on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      startStream().catch(() => {});
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-start VLM when streaming
  useEffect(() => {
    if (isStreaming && !vlm.isActive) {
      vlm.start(videoRef);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStreaming]);

  // Cleanup VLM on unmount
  useEffect(() => {
    return () => vlm.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Agentic WebSocket
  useEffect(() => {
    if (!isStreaming) return;

    const ws = new OpenEyeWebSocket(serverUrl, "/ws/agentic");
    wsRef.current = ws;

    ws.subscribe((data) => {
      const frame = data as AgenticFrame;
      if (frame.type === "agentic_frame") {
        setAgenticFrame(frame);
        if (
          frame.vlm_reasoning?.description &&
          !frame.vlm_reasoning.description.startsWith("VLM")
        ) {
          setEvents((prev) =>
            [
              {
                time: Date.now(),
                text: `VLM: ${frame.vlm_reasoning!.description.slice(0, 80)}`,
                type: "vlm",
              },
              ...prev,
            ].slice(0, 20),
          );
        }
        if (frame.safety_alerts?.length > 0) {
          frame.safety_alerts.forEach((alert) => {
            setEvents((prev) =>
              [
                {
                  time: Date.now(),
                  text: `SAFETY: ${alert.message}`,
                  type: alert.halt_recommended ? "danger" : "caution",
                },
                ...prev,
              ].slice(0, 20),
            );
          });
        }
      }
    });

    ws.connect();

    // Send frames to agentic loop
    if (!canvasRef.current)
      canvasRef.current = document.createElement("canvas");
    const canvas = canvasRef.current;

    const sendFrame = () => {
      const video = videoRef.current;
      if (!video || !ws.connected) return;
      if (video.videoWidth === 0 || video.videoHeight === 0) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
      const base64 = dataUrl.split(",")[1];
      ws.send(JSON.stringify({ frame: base64, goal: goalRef.current }));
    };

    const startTimer = setTimeout(() => {
      intervalRef.current = setInterval(sendFrame, 150);
    }, 500);

    return () => {
      clearTimeout(startTimer);
      if (intervalRef.current) clearInterval(intervalRef.current);
      ws.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStreaming, serverUrl]);

  // Poll Nebius stats
  useEffect(() => {
    if (!isConnected) {
      setNebiusStats(null);
      return;
    }

    let cancelled = false;

    const fetchStats = async () => {
      try {
        const stats = await client.nebiusStats();
        if (!cancelled) setNebiusStats(stats);
      } catch {
        if (!cancelled) setNebiusStats(null);
      }
    };
    fetchStats();
    const id = setInterval(fetchStats, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [isConnected, client]);

  // Sync goal ref
  useEffect(() => {
    goalRef.current = goal;
  }, [goal]);

  // Set goal handler
  const handleSetGoal = useCallback(() => {
    const newGoal = goalInput.trim();
    if (!newGoal) return;
    setGoal(newGoal);
    goalRef.current = newGoal;
    if (wsRef.current?.connected) {
      wsRef.current.send(JSON.stringify({ set_goal: newGoal, frame: "" }));
    }
    setEvents((prev) =>
      [
        { time: Date.now(), text: `Goal: ${newGoal}`, type: "goal" },
        ...prev,
      ].slice(0, 20),
    );
  }, [goalInput]);

  return (
    <div
      className={`h-screen w-screen overflow-hidden bg-black flex flex-col font-mono ${hasDanger ? "animate-hackathon-danger-pulse" : ""}`}
    >
      <HackathonHeader
        phase={phase}
        fps={metrics.fps}
        latency={metrics.latency_ms}
        isConnected={isConnected}
        nebiusStats={nebiusStats}
      />

      <div className="flex-1 flex min-h-0">
        {/* Left: Camera */}
        <div className="flex-[3] relative min-w-0 flex items-center justify-center bg-black">
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-full max-h-full">
              <LiveCameraFeed />
            </div>
          </div>

          {agenticFrame?.detections && agenticFrame.detections.length > 0 && (
            <DetectionOverlay detections={agenticFrame.detections} />
          )}

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none">
            <SafetyBadge level={safetyLevel} />
          </div>
        </div>

        {/* Right: Intelligence Panel */}
        <div className="flex-[2] border-l border-white/10 flex flex-col min-w-0 bg-black/90">
          <IntelligencePanel
            vlmText={vlmDisplayed}
            vlmTyping={vlmTyping}
            vlmLatency={vlm.latencyMs}
            vlmPending={vlm.isPending}
            agenticFrame={agenticFrame}
            goal={goal}
            safetyLevel={safetyLevel}
          />
        </div>
      </div>

      <BottomBar
        goalInput={goalInput}
        setGoalInput={setGoalInput}
        onSetGoal={handleSetGoal}
        events={events}
        nebiusStats={nebiusStats}
        agenticFrame={agenticFrame}
      />
    </div>
  );
}

export default function HackathonDemo() {
  return (
    <OpenEyeConnectionProvider>
      <OpenEyeStreamProvider>
        <HackathonDemoInner />
      </OpenEyeStreamProvider>
    </OpenEyeConnectionProvider>
  );
}
