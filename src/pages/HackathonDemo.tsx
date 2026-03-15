import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { OpenEyeConnectionProvider, useOpenEyeConnection } from "@/hooks/useOpenEyeConnection";
import { OpenEyeStreamProvider, useOpenEyeStream } from "@/hooks/useOpenEyeStream";
import { useVLMStream } from "@/hooks/useVLMStream";
import { OpenEyeWebSocket } from "@/lib/openeye-ws";
import { LiveCameraFeed } from "@/components/dashboard/LiveCameraFeed";
import { motion, AnimatePresence } from "framer-motion";
import {
  Eye,
  Brain,
  Zap,
  Shield,
  Target,
  AlertTriangle,
  Activity,
  Send,
  Loader2,
} from "lucide-react";

// --- Types (from AgenticLoop) ---

interface AgenticDetection {
  track_id: string;
  label: string;
  confidence: number;
  bbox:
    | { x: number; y: number; w: number; h: number }
    | { x1: number; y1: number; x2: number; y2: number };
  is_manipulable?: boolean;
}

interface AgenticFrame {
  type: "agentic_frame";
  frame_id: number;
  goal: string;
  detections: AgenticDetection[];
  scene_graph: Record<string, unknown>;
  scene_description: string;
  vlm_reasoning: {
    description: string;
    reasoning: string;
    latency_ms: number;
  } | null;
  action_plan: Array<{
    action: string;
    target_id?: string | null;
    reason: string;
    priority: number;
  }>;
  safety_zones: Array<{ zone: string; distance_m: number }>;
  safety_alerts: Array<{
    message: string;
    zone: string;
    halt_recommended: boolean;
  }>;
  change_alerts: Array<{ change_type: string; description: string }>;
  memory: {
    objects_seen: Record<
      string,
      { label: string; frames_seen: number; seconds_tracked: number }
    >;
    timeline: Array<{ timestamp: number; event: string; details: string }>;
    frame_count: number;
    total_objects_tracked: number;
  };
  latency: { detection_ms: number; vlm_ms: number; total_ms: number };
}

interface NebiusStats {
  total_calls: number;
  total_tokens_estimated: number;
  total_latency_ms: number;
  avg_latency_ms: number;
  errors: number;
  model: string;
  provider: string;
  configured: boolean;
}

type Phase = "SEE" | "THINK" | "ACT" | "PROTECT";

const PHASES: Phase[] = ["SEE", "THINK", "ACT", "PROTECT"];

const PHASE_ACTIVE_STYLES: Record<Phase, string> = {
  SEE: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-phase-pulse",
  THINK: "bg-amber-500/20 text-amber-400 border border-amber-500/40 animate-phase-pulse",
  ACT: "bg-blue-500/20 text-blue-400 border border-blue-500/40 animate-phase-pulse",
  PROTECT: "bg-red-500/20 text-red-400 border border-red-500/40 animate-phase-pulse",
};

function detectPhase(
  isStreaming: boolean,
  hasVLM: boolean,
  hasGoal: boolean,
  hasDanger: boolean,
): Phase {
  if (hasDanger) return "PROTECT";
  if (hasGoal && hasVLM) return "ACT";
  if (hasVLM) return "THINK";
  return "SEE";
}

// --- Typewriter hook ---

function useTypewriter(text: string, speed: number = 20) {
  const [displayed, setDisplayed] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const prevTextRef = useRef("");

  useEffect(() => {
    if (!text) {
      setDisplayed("");
      setIsTyping(false);
      return;
    }
    if (text === prevTextRef.current) return;
    prevTextRef.current = text;
    setIsTyping(true);
    setDisplayed("");
    let i = 0;
    const timer = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(timer);
        setIsTyping(false);
      }
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed]);

  return { displayed, isTyping };
}

// --- Main inner component ---

function HackathonDemoInner() {
  const { serverUrl, isConnected } = useOpenEyeConnection();
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

  const detectionCount =
    latestResult?.objects?.length ?? agenticFrame?.detections?.length ?? 0;
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
    const fetchStats = async () => {
      try {
        const resp = await fetch(`${serverUrl}/nebius/stats`);
        if (resp.ok) setNebiusStats(await resp.json());
      } catch {
        /* ignore */
      }
    };
    fetchStats();
    const id = setInterval(fetchStats, 5000);
    return () => clearInterval(id);
  }, [serverUrl]);

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
      {/* === HEADER === */}
      <HackathonHeader
        phase={phase}
        fps={metrics.fps}
        latency={metrics.latency_ms}
        isConnected={isConnected}
        nebiusStats={nebiusStats}
      />

      {/* === MAIN CONTENT === */}
      <div className="flex-1 flex min-h-0">
        {/* Left: Camera */}
        <div className="flex-[3] relative min-w-0 flex items-center justify-center bg-black">
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-full max-h-full">
              <LiveCameraFeed />
            </div>
          </div>

          {/* Agentic detection overlays */}
          {agenticFrame?.detections && agenticFrame.detections.length > 0 && (
            <div className="absolute inset-0 pointer-events-none">
              {agenticFrame.detections.map((det) => {
                const x = "x" in det.bbox ? det.bbox.x : det.bbox.x1;
                const y = "y" in det.bbox ? det.bbox.y : det.bbox.y1;
                const w =
                  "w" in det.bbox ? det.bbox.w : det.bbox.x2 - det.bbox.x1;
                const h =
                  "h" in det.bbox ? det.bbox.h : det.bbox.y2 - det.bbox.y1;
                const border = det.is_manipulable
                  ? "border-amber-400"
                  : "border-cyan-400/60";
                const bg = det.is_manipulable
                  ? "bg-amber-400/10"
                  : "bg-cyan-400/5";
                const corner = det.is_manipulable
                  ? "border-amber-400"
                  : "border-cyan-400";
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
                    <div className={`w-full h-full border ${border} ${bg}`} />
                    <div
                      className={`absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 ${corner}`}
                    />
                    <div
                      className={`absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 ${corner}`}
                    />
                    <div
                      className={`absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 ${corner}`}
                    />
                    <div
                      className={`absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 ${corner}`}
                    />
                  </div>
                );
              })}
            </div>
          )}

          {/* Safety level badge (centered bottom of camera) */}
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

      {/* === BOTTOM BAR === */}
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

// --- Safety Badge ---

function SafetyBadge({ level }: { level: "SAFE" | "CAUTION" | "DANGER" }) {
  const styles =
    level === "DANGER"
      ? "bg-red-500/20 border-red-500/50 text-red-400 animate-pulse"
      : level === "CAUTION"
        ? "bg-yellow-500/20 border-yellow-500/50 text-yellow-400"
        : "bg-emerald-500/20 border-emerald-500/50 text-emerald-400";
  return (
    <div
      className={`px-4 py-1.5 rounded-full backdrop-blur-sm text-xs font-bold tracking-widest border ${styles}`}
    >
      <Shield className="inline h-3 w-3 mr-1.5 -mt-0.5" />
      {level}
    </div>
  );
}

// --- Header ---

function HackathonHeader({
  phase,
  fps,
  latency,
  isConnected,
  nebiusStats,
}: {
  phase: Phase;
  fps: number;
  latency: number;
  isConnected: boolean;
  nebiusStats: NebiusStats | null;
}) {
  return (
    <div className="h-10 flex items-center justify-between px-4 border-b border-white/10 bg-black/95 shrink-0">
      {/* Logo + Phase */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_hsl(153,100%,50%)]" />
          <span className="text-white text-xs font-bold tracking-[0.2em]">
            OPENEYE
          </span>
          <span className="text-white/30 text-xs">▸</span>
          <span className="text-emerald-400 text-xs tracking-wider">
            PERCEPTION OS
          </span>
        </div>

        {/* Phase indicators */}
        <div className="flex items-center gap-1 ml-4">
          {PHASES.map((p) => (
            <div
              key={p}
              className={`px-2 py-0.5 text-[10px] tracking-wider rounded transition-all ${
                p === phase
                  ? PHASE_ACTIVE_STYLES[p]
                  : "text-white/20 border border-transparent"
              }`}
            >
              {p}
            </div>
          ))}
        </div>
      </div>

      {/* Right: Stats */}
      <div className="flex items-center gap-4 text-[10px]">
        <div className="flex items-center gap-1.5">
          <div
            className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-emerald-400" : "bg-red-500"}`}
          />
          <span className={isConnected ? "text-emerald-400" : "text-red-400"}>
            {isConnected ? "ONLINE" : "OFFLINE"}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <Activity className="h-3 w-3 text-white/40" />
          <span
            className={
              fps > 15
                ? "text-emerald-400"
                : fps > 5
                  ? "text-amber-400"
                  : "text-red-400"
            }
          >
            {fps} FPS
          </span>
        </div>

        <div className="flex items-center gap-1">
          <Zap className="h-3 w-3 text-white/40" />
          <span
            className={
              latency < 50
                ? "text-emerald-400"
                : latency < 100
                  ? "text-amber-400"
                  : "text-red-400"
            }
          >
            {latency.toFixed(0)}ms
          </span>
        </div>

        {nebiusStats?.configured && (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 animate-hackathon-glow">
            <span className="text-blue-400">NEBIUS</span>
            <span className="text-white/50">
              {nebiusStats.total_calls} calls
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Intelligence Panel ---

function IntelligencePanel({
  vlmText,
  vlmTyping,
  vlmLatency,
  vlmPending,
  agenticFrame,
  goal,
  safetyLevel,
}: {
  vlmText: string;
  vlmTyping: boolean;
  vlmLatency: number;
  vlmPending: boolean;
  agenticFrame: AgenticFrame | null;
  goal: string;
  safetyLevel: string;
}) {
  return (
    <div className="flex-1 flex flex-col overflow-y-auto scrollbar-thin p-3 gap-3">
      {/* VLM Scene Understanding */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-[10px] text-amber-400 uppercase tracking-wider">
          <Brain className="h-3.5 w-3.5" />
          <span>Scene Understanding</span>
          {vlmLatency > 0 && (
            <span className="ml-auto text-white/30 tabular-nums">
              {vlmLatency.toFixed(0)}ms
            </span>
          )}
          {vlmPending && (
            <Loader2 className="ml-auto h-3 w-3 animate-spin text-amber-400/50" />
          )}
        </div>
        <div className="bg-white/5 rounded-md border border-white/10 p-3 min-h-[80px]">
          {vlmText ? (
            <p className="text-xs text-white/80 leading-relaxed whitespace-pre-wrap">
              {vlmText}
              {vlmTyping && (
                <span className="inline-block w-1.5 h-3.5 bg-amber-400 ml-0.5 animate-pulse" />
              )}
            </p>
          ) : (
            <p className="text-xs text-white/20 italic">
              Waiting for VLM reasoning...
            </p>
          )}
        </div>
      </div>

      {/* Agentic Reasoning / Action Plan */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-[10px] text-emerald-400 uppercase tracking-wider">
          <Target className="h-3.5 w-3.5" />
          <span>Agentic Reasoning</span>
          {goal && (
            <span className="ml-auto text-white/20 truncate max-w-[160px]">
              Goal: {goal}
            </span>
          )}
        </div>

        <div className="space-y-1.5">
          <AnimatePresence mode="popLayout">
            {agenticFrame?.action_plan &&
            agenticFrame.action_plan.length > 0 ? (
              agenticFrame.action_plan
                .sort((a, b) => b.priority - a.priority)
                .slice(0, 4)
                .map((step, i) => {
                  const priorityCls =
                    step.priority >= 0.8
                      ? "text-red-400"
                      : step.priority >= 0.6
                        ? "text-amber-400"
                        : "text-emerald-400";
                  const badgeCls =
                    step.priority >= 0.8
                      ? "bg-red-500/20 text-red-400"
                      : step.priority >= 0.6
                        ? "bg-amber-500/20 text-amber-400"
                        : "bg-emerald-500/20 text-emerald-400";
                  return (
                    <motion.div
                      key={`${step.action}-${i}`}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-start gap-2 p-2 rounded bg-white/5 border border-white/10"
                    >
                      <span
                        className={`text-[10px] font-bold tabular-nums mt-0.5 ${priorityCls}`}
                      >
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div className="flex-1 min-w-0">
                        <span
                          className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${badgeCls}`}
                        >
                          {step.action.replace(/_/g, " ")}
                        </span>
                        <p className="text-[11px] text-white/50 mt-1 line-clamp-2">
                          {step.reason}
                        </p>
                      </div>
                    </motion.div>
                  );
                })
            ) : (
              <div className="text-xs text-white/20 italic p-3 text-center">
                {agenticFrame
                  ? "Analyzing scene..."
                  : "Connecting to agentic loop..."}
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Agentic VLM reasoning */}
      {agenticFrame?.vlm_reasoning?.description &&
        !agenticFrame.vlm_reasoning.description.startsWith("VLM") && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[10px] text-cyan-400 uppercase tracking-wider">
              <Brain className="h-3.5 w-3.5" />
              <span>Agentic VLM</span>
              <span className="ml-auto text-white/30 tabular-nums">
                {agenticFrame.vlm_reasoning.latency_ms.toFixed(0)}ms
              </span>
            </div>
            <div className="bg-cyan-500/5 rounded-md border border-cyan-500/10 p-2">
              <p className="text-[11px] text-white/60 leading-relaxed line-clamp-3">
                {agenticFrame.vlm_reasoning.description}
              </p>
            </div>
          </div>
        )}

      {/* Safety Guardian */}
      <div className="space-y-2">
        <div
          className={`flex items-center gap-2 text-[10px] uppercase tracking-wider ${
            safetyLevel === "DANGER"
              ? "text-red-400"
              : safetyLevel === "CAUTION"
                ? "text-yellow-400"
                : "text-emerald-400"
          }`}
        >
          <Shield className="h-3.5 w-3.5" />
          <span>Safety Guardian</span>
          <span
            className={`ml-auto px-2 py-0.5 rounded text-[9px] font-bold tracking-widest ${
              safetyLevel === "DANGER"
                ? "bg-red-500/20 border border-red-500/40 animate-pulse"
                : safetyLevel === "CAUTION"
                  ? "bg-yellow-500/20 border border-yellow-500/40"
                  : "bg-emerald-500/20 border border-emerald-500/40"
            }`}
          >
            {safetyLevel}
          </span>
        </div>

        <AnimatePresence>
          {agenticFrame?.safety_alerts &&
          agenticFrame.safety_alerts.length > 0 ? (
            <div className="space-y-1.5">
              {agenticFrame.safety_alerts.map((alert, i) => (
                <motion.div
                  key={`${alert.zone}-${alert.message}-${i}`}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className={`flex items-center gap-2 text-[11px] p-2 rounded border ${
                    alert.halt_recommended
                      ? "bg-red-500/10 border-red-500/30 text-red-400"
                      : "bg-yellow-500/5 border-yellow-500/20 text-yellow-400"
                  }`}
                >
                  <AlertTriangle
                    className={`h-3.5 w-3.5 shrink-0 ${alert.halt_recommended ? "animate-pulse" : ""}`}
                  />
                  <div className="flex-1">
                    <span>{alert.message}</span>
                    {alert.halt_recommended && (
                      <span className="ml-2 text-[9px] bg-red-500/30 px-1.5 py-0.5 rounded font-bold tracking-wider">
                        HALT
                      </span>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="bg-white/5 rounded-md border border-white/10 p-3">
              <div className="flex items-center gap-2 text-[11px] text-emerald-400/50">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                All zones clear
              </div>
            </div>
          )}
        </AnimatePresence>

        {/* Safety zones */}
        {agenticFrame?.safety_zones &&
          agenticFrame.safety_zones.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {agenticFrame.safety_zones.map((zone) => {
                const cls =
                  zone.distance_m < 0.5
                    ? "bg-red-500/10 border-red-500/20 text-red-400"
                    : zone.distance_m < 1.5
                      ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-400"
                      : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400";
                return (
                  <div
                    key={zone.zone}
                    className={`text-[10px] px-2 py-1 rounded border tabular-nums ${cls}`}
                  >
                    {zone.zone}: {zone.distance_m.toFixed(1)}m
                  </div>
                );
              })}
            </div>
          )}
      </div>

      {/* Live detections list */}
      {agenticFrame?.detections && agenticFrame.detections.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[10px] text-white/40 uppercase tracking-wider">
            <Eye className="h-3.5 w-3.5" />
            <span>Detections</span>
            <span className="ml-auto tabular-nums">
              {agenticFrame.detections.length}
            </span>
          </div>
          <div className="space-y-1 max-h-[120px] overflow-y-auto scrollbar-thin">
            {agenticFrame.detections.slice(0, 8).map((det) => (
              <div
                key={det.track_id}
                className="flex items-center justify-between text-[10px] px-2 py-1 rounded bg-white/5"
              >
                <div className="flex items-center gap-1.5">
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${det.is_manipulable ? "bg-amber-400" : "bg-emerald-400"}`}
                  />
                  <span className="text-white/70">{det.label}</span>
                  <span className="text-white/20">#{det.track_id}</span>
                </div>
                <span className="text-white/30 tabular-nums">
                  {(det.confidence * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Bottom Bar ---

function BottomBar({
  goalInput,
  setGoalInput,
  onSetGoal,
  events,
  nebiusStats,
  agenticFrame,
}: {
  goalInput: string;
  setGoalInput: (v: string) => void;
  onSetGoal: () => void;
  events: Array<{ time: number; text: string; type: string }>;
  nebiusStats: NebiusStats | null;
  agenticFrame: AgenticFrame | null;
}) {
  return (
    <div className="h-12 flex items-center gap-4 px-4 border-t border-white/10 bg-black/95 shrink-0">
      {/* Goal input */}
      <div className="flex items-center gap-2 flex-[2]">
        <Target className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
        <input
          value={goalInput}
          onChange={(e) => setGoalInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSetGoal()}
          placeholder="Set agent goal..."
          className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-[11px] text-white/80 placeholder:text-white/20 focus:outline-none focus:border-emerald-500/40 font-mono"
        />
        <button
          onClick={onSetGoal}
          className="text-[10px] px-2 py-1 rounded bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
        >
          <Send className="h-3 w-3" />
        </button>
      </div>

      {/* Event timeline */}
      <div className="flex-[3] overflow-hidden">
        <div className="flex items-center gap-3 text-[10px] overflow-x-auto scrollbar-hide">
          {events.slice(0, 5).map((evt, i) => (
            <span
              key={`${evt.time}-${i}`}
              className={`whitespace-nowrap ${
                evt.type === "danger"
                  ? "text-red-400"
                  : evt.type === "caution"
                    ? "text-yellow-400"
                    : evt.type === "goal"
                      ? "text-emerald-400"
                      : "text-white/30"
              }`}
            >
              {evt.text}
            </span>
          ))}
          {events.length === 0 && (
            <span className="text-white/15">Events will appear here...</span>
          )}
        </div>
      </div>

      {/* Nebius stats */}
      <div className="flex items-center gap-3 text-[10px] text-white/30 shrink-0">
        {nebiusStats?.configured ? (
          <>
            <span className="text-blue-400">NEBIUS</span>
            <span className="tabular-nums">
              {nebiusStats.total_calls} calls
            </span>
            <span className="text-white/15">|</span>
            <span className="tabular-nums">
              {(nebiusStats.total_tokens_estimated / 1000).toFixed(1)}k tok
            </span>
            <span className="text-white/15">|</span>
            <span className="tabular-nums">
              {nebiusStats.avg_latency_ms.toFixed(0)}ms avg
            </span>
          </>
        ) : (
          <span>Nebius: not configured</span>
        )}
        {agenticFrame && (
          <>
            <span className="text-white/15">|</span>
            <span className="tabular-nums">
              {agenticFrame.memory.frame_count}f
            </span>
          </>
        )}
      </div>
    </div>
  );
}

// --- Exported Page ---

export default function HackathonDemo() {
  return (
    <OpenEyeConnectionProvider>
      <OpenEyeStreamProvider>
        <HackathonDemoInner />
      </OpenEyeStreamProvider>
    </OpenEyeConnectionProvider>
  );
}
