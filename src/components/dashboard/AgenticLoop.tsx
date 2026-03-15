import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { useOpenEyeConnection } from "@/hooks/useOpenEyeConnection";
import { OpenEyeWebSocket } from "@/lib/openeye-ws";
import {
  Brain,
  Target,
  Eye,
  Zap,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Send,
  RotateCcw,
  Activity,
} from "lucide-react";

// --- Types for agentic loop data ---

interface AgenticDetection {
  track_id: string;
  label: string;
  confidence: number;
  bbox: { x: number; y: number; w: number; h: number } | { x1: number; y1: number; x2: number; y2: number };
  is_manipulable?: boolean;
}

interface AgenticVLMReasoning {
  description: string;
  reasoning: string;
  latency_ms: number;
}

interface AgenticActionStep {
  action: string;
  target_id?: string | null;
  reason: string;
  priority: number;
}

interface TimelineEvent {
  timestamp: number;
  event: string;
  details: string;
}

interface MemorySnapshot {
  objects_seen: Record<string, { label: string; frames_seen: number; seconds_tracked: number }>;
  timeline: TimelineEvent[];
  frame_count: number;
  total_objects_tracked: number;
}

interface AgenticLatency {
  detection_ms: number;
  vlm_ms: number;
  total_ms: number;
}

interface AgenticFrame {
  type: "agentic_frame";
  frame_id: number;
  goal: string;
  detections: AgenticDetection[];
  scene_graph: Record<string, unknown>;
  scene_description: string;
  vlm_reasoning: AgenticVLMReasoning | null;
  action_plan: AgenticActionStep[];
  safety_zones: Array<{ zone: string; distance_m: number }>;
  safety_alerts: Array<{ message: string; zone: string; halt_recommended: boolean }>;
  change_alerts: Array<{ change_type: string; description: string }>;
  memory: MemorySnapshot;
  latency: AgenticLatency;
}

// --- Preset goals for quick demo ---
const PRESET_GOALS = [
  "Pick up the red cup",
  "Navigate to the door",
  "Identify all hazards",
  "Find the nearest person",
  "Observe and describe the scene",
];

// --- Helper: format relative timestamp ---
function formatTimeAgo(ts: number): string {
  const seconds = Math.floor(Date.now() / 1000 - ts);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ago`;
}

// --- Priority color ---
function priorityColor(priority: number): string {
  if (priority >= 0.8) return "text-terminal-red";
  if (priority >= 0.6) return "text-terminal-amber";
  return "text-terminal-green";
}

function priorityBadge(priority: number): string {
  if (priority >= 0.8) return "destructive";
  if (priority >= 0.6) return "secondary";
  return "default";
}

// --- Main Component ---

interface AgenticLoopProps {
  /** Ref to the video element for frame capture */
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** External control: whether the camera is streaming */
  isStreaming: boolean;
}

export function AgenticLoop({ videoRef, isStreaming }: AgenticLoopProps) {
  const { serverUrl } = useOpenEyeConnection();

  // State
  const [connected, setConnected] = useState(false);
  const [running, setRunning] = useState(false);
  const [goal, setGoal] = useState("");
  const [goalInput, setGoalInput] = useState("");
  const goalRef = useRef(goal);
  const [latestFrame, setLatestFrame] = useState<AgenticFrame | null>(null);
  const [vlmHistory, setVlmHistory] = useState<Array<{ timestamp: number; description: string }>>([]);
  const [fps, setFps] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);

  // Refs
  const wsRef = useRef<OpenEyeWebSocket | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fpsBuffer = useRef<number[]>([]);

  // Connect WebSocket
  const connectWs = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.disconnect();
    }

    const ws = new OpenEyeWebSocket(serverUrl, "/ws/agentic");
    wsRef.current = ws;

    ws.onStatus(({ connected: c }) => setConnected(c));

    ws.subscribe((data) => {
      const frame = data as AgenticFrame;
      if (frame.type === "agentic_frame") {
        setLatestFrame(frame);
        setTotalFrames(frame.memory?.frame_count ?? 0);

        // Track FPS
        const now = performance.now();
        fpsBuffer.current.push(now);
        if (fpsBuffer.current.length > 30) fpsBuffer.current.shift();
        const elapsed =
          fpsBuffer.current.length > 1
            ? (now - fpsBuffer.current[0]) / 1000
            : 1;
        setFps(Math.round(fpsBuffer.current.length / elapsed));

        // Track VLM history
        if (frame.vlm_reasoning?.description && !frame.vlm_reasoning.description.startsWith("VLM")) {
          setVlmHistory((prev) => {
            const next = [
              { timestamp: Date.now() / 1000, description: frame.vlm_reasoning!.description },
              ...prev,
            ];
            return next.slice(0, 20);
          });
        }
      }
    });

    ws.connect();
  }, [serverUrl]);

  // Disconnect + cleanup
  const disconnect = useCallback(() => {
    if (startTimeoutRef.current) {
      clearTimeout(startTimeoutRef.current);
      startTimeoutRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    wsRef.current?.disconnect();
    wsRef.current = null;
    setConnected(false);
    setRunning(false);
  }, []);

  // Start sending frames
  const startLoop = useCallback(() => {
    if (!wsRef.current || !videoRef.current) return;

    if (!canvasRef.current) {
      canvasRef.current = document.createElement("canvas");
    }
    const canvas = canvasRef.current;

    const sendFrame = () => {
      const video = videoRef.current;
      const ws = wsRef.current;
      if (!video || !ws?.connected) return;
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

    intervalRef.current = setInterval(sendFrame, 150); // ~7 Hz for agentic (balanced)
    setRunning(true);
  }, [videoRef]);

  // Stop the loop
  const stopLoop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setRunning(false);
  }, []);

  // Set goal
  const handleSetGoal = useCallback(() => {
    const newGoal = goalInput.trim();
    if (!newGoal) return;
    setGoal(newGoal);
    goalRef.current = newGoal;
    if (wsRef.current?.connected) {
      wsRef.current.send(JSON.stringify({ set_goal: newGoal, frame: "" }));
    }
  }, [goalInput]);

  // Auto-connect when streaming starts
  useEffect(() => {
    if (isStreaming && !wsRef.current) {
      connectWs();
    }
    return () => {
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStreaming]);

  // Sync goal ref when goal state changes
  useEffect(() => {
    goalRef.current = goal;
  }, [goal]);

  // Cleanup on unmount
  useEffect(() => {
    return () => disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const detectionCount = latestFrame?.detections?.length ?? 0;
  const hasSafetyAlerts = (latestFrame?.safety_alerts?.length ?? 0) > 0;

  return (
    <div className="space-y-4">
      {/* --- Control Bar --- */}
      <Card className="border-terminal-green/20 bg-background/80 backdrop-blur">
        <CardContent className="pt-4 pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            {/* Goal input */}
            <div className="flex-1 space-y-1.5">
              <label className="text-xs font-mono text-terminal-green/70 uppercase tracking-wider flex items-center gap-1.5">
                <Target className="h-3 w-3" />
                Agent Goal
              </label>
              <div className="flex gap-2">
                <Input
                  value={goalInput}
                  onChange={(e) => setGoalInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSetGoal()}
                  placeholder="e.g. Pick up the red cup"
                  className="font-mono text-sm border-terminal-green/20 focus-visible:ring-terminal-green/30"
                />
                <Button
                  onClick={handleSetGoal}
                  size="sm"
                  variant="outline"
                  className="border-terminal-green/30 text-terminal-green hover:bg-terminal-green/10 gap-1.5"
                >
                  <Send className="h-3.5 w-3.5" />
                  Set
                </Button>
              </div>
              {/* Preset quick-select */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {PRESET_GOALS.map((preset) => (
                  <button
                    key={preset}
                    onClick={() => {
                      setGoalInput(preset);
                      setGoal(preset);
                      goalRef.current = preset;
                      if (wsRef.current?.connected) {
                        wsRef.current.send(JSON.stringify({ set_goal: preset, frame: "" }));
                      }
                    }}
                    className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors ${
                      goal === preset
                        ? "border-terminal-green bg-terminal-green/20 text-terminal-green"
                        : "border-muted-foreground/20 text-muted-foreground hover:border-terminal-green/40 hover:text-terminal-green/70"
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              {!running ? (
                <Button
                  onClick={() => {
                    if (!connected) connectWs();
                    startTimeoutRef.current = setTimeout(startLoop, 300);
                  }}
                  disabled={!isStreaming}
                  className="gap-2 bg-terminal-green hover:bg-terminal-green/80 text-primary-foreground"
                >
                  <Brain className="h-4 w-4" />
                  Start Agent
                </Button>
              ) : (
                <Button
                  onClick={stopLoop}
                  variant="destructive"
                  className="gap-2"
                >
                  <RotateCcw className="h-4 w-4" />
                  Stop
                </Button>
              )}
            </div>
          </div>

          {/* Active goal display */}
          {goal && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 flex items-center gap-2 px-3 py-1.5 rounded-md bg-terminal-green/10 border border-terminal-green/20"
            >
              <Target className="h-3.5 w-3.5 text-terminal-green" />
              <span className="font-mono text-xs text-terminal-green">
                ACTIVE GOAL:
              </span>
              <span className="font-mono text-xs text-foreground">{goal}</span>
            </motion.div>
          )}
        </CardContent>
      </Card>

      {/* --- Status HUD --- */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatusCard
          icon={<Activity className="h-4 w-4" />}
          label="FPS"
          value={running ? `${fps}` : "--"}
          color="terminal-green"
        />
        <StatusCard
          icon={<Zap className="h-4 w-4" />}
          label="Detection"
          value={latestFrame ? `${latestFrame.latency.detection_ms.toFixed(0)}ms` : "--"}
          color={
            latestFrame && latestFrame.latency.detection_ms < 100
              ? "terminal-green"
              : "terminal-amber"
          }
        />
        <StatusCard
          icon={<Brain className="h-4 w-4" />}
          label="VLM"
          value={latestFrame?.latency.vlm_ms ? `${latestFrame.latency.vlm_ms.toFixed(0)}ms` : "idle"}
          color="terminal-amber"
        />
        <StatusCard
          icon={<Eye className="h-4 w-4" />}
          label="Objects"
          value={running ? `${detectionCount}` : "--"}
          color={hasSafetyAlerts ? "terminal-red" : "terminal-green"}
        />
      </div>

      {/* --- Main Content Grid --- */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Left: Action Plan + VLM Reasoning */}
        <div className="space-y-4">
          {/* Action Plan */}
          <Card className="border-terminal-green/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-mono flex items-center gap-2 text-terminal-green">
                <ChevronRight className="h-4 w-4" />
                ACTION PLAN
                {latestFrame && (
                  <Badge variant="outline" className="ml-auto text-[10px] border-terminal-green/30">
                    {latestFrame.action_plan.length} steps
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AnimatePresence mode="popLayout">
                {latestFrame?.action_plan && latestFrame.action_plan.length > 0 ? (
                  <div className="space-y-2">
                    {latestFrame.action_plan
                      .sort((a, b) => b.priority - a.priority)
                      .slice(0, 5)
                      .map((step, i) => (
                        <motion.div
                          key={`${step.action}-${step.target_id}-${i}`}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 8 }}
                          transition={{ delay: i * 0.05 }}
                          className="flex items-start gap-2 p-2 rounded-md bg-muted/50 border border-border/50"
                        >
                          <span className={`font-mono text-xs font-bold mt-0.5 ${priorityColor(step.priority)}`}>
                            {(i + 1).toString().padStart(2, "0")}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={priorityBadge(step.priority) as "default" | "secondary" | "destructive"}
                                className="text-[10px] uppercase"
                              >
                                {step.action.replace(/_/g, " ")}
                              </Badge>
                              {step.target_id && (
                                <span className="font-mono text-[10px] text-muted-foreground">
                                  target: {step.target_id}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {step.reason}
                            </p>
                          </div>
                          <div className="shrink-0">
                            <Progress
                              value={step.priority * 100}
                              className="w-12 h-1.5"
                            />
                          </div>
                        </motion.div>
                      ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground font-mono py-4 text-center">
                    {running ? "Analyzing scene..." : "Start agent to generate action plan"}
                  </p>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>

          {/* VLM Reasoning */}
          <Card className="border-terminal-amber/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-mono flex items-center gap-2 text-terminal-amber">
                <Brain className="h-4 w-4" />
                VLM REASONING
                {latestFrame?.vlm_reasoning?.latency_ms ? (
                  <Badge variant="outline" className="ml-auto text-[10px] border-terminal-amber/30">
                    {latestFrame.vlm_reasoning.latency_ms.toFixed(0)}ms
                  </Badge>
                ) : running ? (
                  <Loader2 className="ml-auto h-3 w-3 animate-spin text-terminal-amber/50" />
                ) : null}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {latestFrame?.vlm_reasoning?.description &&
              !latestFrame.vlm_reasoning.description.startsWith("VLM not configured") ? (
                <motion.div
                  key={latestFrame.vlm_reasoning.description.slice(0, 20)}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-2"
                >
                  <p className="text-sm leading-relaxed">{latestFrame.vlm_reasoning.description}</p>
                  <p className="text-[10px] font-mono text-muted-foreground">
                    {latestFrame.vlm_reasoning.reasoning}
                  </p>
                </motion.div>
              ) : (
                <p className="text-xs text-muted-foreground font-mono py-4 text-center">
                  {running
                    ? "VLM reasoning runs every 3s..."
                    : "Start agent for VLM analysis"}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Safety Alerts */}
          <AnimatePresence>
            {hasSafetyAlerts && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <Card className="border-terminal-red/30 bg-terminal-red/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-mono flex items-center gap-2 text-terminal-red">
                      <AlertTriangle className="h-4 w-4" />
                      SAFETY ALERTS
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1.5">
                      {latestFrame?.safety_alerts.map((alert, i) => (
                        <div
                          key={`${alert.zone}-${alert.message}`}
                          className="flex items-center gap-2 text-xs font-mono"
                        >
                          {alert.halt_recommended ? (
                            <AlertTriangle className="h-3 w-3 text-terminal-red shrink-0" />
                          ) : (
                            <AlertTriangle className="h-3 w-3 text-terminal-amber shrink-0" />
                          )}
                          <span className={alert.halt_recommended ? "text-terminal-red" : "text-terminal-amber"}>
                            {alert.message}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right: Memory + Timeline */}
        <div className="space-y-4">
          {/* Scene Description */}
          {latestFrame?.scene_description && (
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-mono flex items-center gap-2 text-foreground/80">
                  <Eye className="h-4 w-4" />
                  SCENE
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">{latestFrame.scene_description}</p>
              </CardContent>
            </Card>
          )}

          {/* Object Memory */}
          <Card className="border-terminal-green/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-mono flex items-center gap-2 text-terminal-green">
                <Eye className="h-4 w-4" />
                OBJECT MEMORY
                {latestFrame?.memory && (
                  <Badge variant="outline" className="ml-auto text-[10px] border-terminal-green/30">
                    {latestFrame.memory.total_objects_tracked} tracked
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {latestFrame?.memory?.objects_seen &&
              Object.keys(latestFrame.memory.objects_seen).length > 0 ? (
                <ScrollArea className="max-h-48">
                  <div className="space-y-1">
                    {Object.entries(latestFrame.memory.objects_seen).map(
                      ([trackId, info]) => (
                        <div
                          key={trackId}
                          className="flex items-center justify-between py-1 px-2 rounded bg-muted/30 font-mono text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-3 w-3 text-terminal-green shrink-0" />
                            <span>{info.label}</span>
                          </div>
                          <div className="flex items-center gap-3 text-muted-foreground">
                            <span>{info.frames_seen}f</span>
                            <span>{info.seconds_tracked}s</span>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </ScrollArea>
              ) : (
                <p className="text-xs text-muted-foreground font-mono py-4 text-center">
                  {running ? "Waiting for detections..." : "No objects tracked yet"}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card className="border-terminal-green/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-mono flex items-center gap-2 text-terminal-green">
                <Clock className="h-4 w-4" />
                OBSERVATION TIMELINE
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-60">
                {latestFrame?.memory?.timeline && latestFrame.memory.timeline.length > 0 ? (
                  <div className="relative pl-4 border-l border-terminal-green/20 space-y-3">
                    {[...latestFrame.memory.timeline].reverse().map((evt, i) => (
                      <motion.div
                        key={`${evt.timestamp}-${i}`}
                        initial={{ opacity: 0, x: -4 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="relative"
                      >
                        {/* Dot */}
                        <div
                          className={`absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full border-2 ${
                            evt.event === "goal_updated"
                              ? "bg-terminal-amber border-terminal-amber/50"
                              : evt.event === "vlm_reasoning"
                              ? "bg-terminal-amber border-terminal-amber/30"
                              : evt.event === "object_appeared"
                              ? "bg-terminal-green border-terminal-green/50"
                              : evt.event === "object_disappeared"
                              ? "bg-terminal-red border-terminal-red/50"
                              : "bg-muted-foreground border-muted-foreground/30"
                          }`}
                        />
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className="text-[9px] uppercase tracking-wider"
                            >
                              {evt.event.replace(/_/g, " ")}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {formatTimeAgo(evt.timestamp)}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {evt.details}
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground font-mono py-4 text-center">
                    {running ? "Collecting observations..." : "No observations yet"}
                  </p>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* VLM Reasoning History */}
          {vlmHistory.length > 0 && (
            <Card className="border-terminal-amber/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-mono flex items-center gap-2 text-terminal-amber">
                  <Brain className="h-4 w-4" />
                  REASONING HISTORY
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-40">
                  <div className="space-y-2">
                    {vlmHistory.slice(0, 8).map((entry, i) => (
                      <div
                        key={`${entry.timestamp}-${i}`}
                        className="text-xs text-muted-foreground border-l-2 border-terminal-amber/20 pl-2 py-1"
                      >
                        <span className="font-mono text-[10px] text-terminal-amber/60 block">
                          {formatTimeAgo(entry.timestamp)}
                        </span>
                        <span className="line-clamp-2">{entry.description}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Status card sub-component ---

const colorStyles: Record<string, { border: string; text: string }> = {
  "terminal-green": {
    border: "border-terminal-green/20",
    text: "text-terminal-green",
  },
  "terminal-amber": {
    border: "border-terminal-amber/20",
    text: "text-terminal-amber",
  },
  "terminal-red": {
    border: "border-terminal-red/20",
    text: "text-terminal-red",
  },
};

function StatusCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  const styles = colorStyles[color] ?? colorStyles["terminal-green"];
  return (
    <Card className={styles.border}>
      <CardContent className="pt-3 pb-2 px-3">
        <div className="flex items-center gap-2">
          <div className={styles.text}>{icon}</div>
          <div>
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
              {label}
            </p>
            <p className={`text-lg font-semibold font-mono tabular-nums ${styles.text}`}>
              {value}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
