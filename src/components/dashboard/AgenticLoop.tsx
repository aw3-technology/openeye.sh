import { useCallback, useEffect, useRef, useState } from "react";
import { captureFrame, FpsCounter } from "@/lib/frame-capture";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useOpenEyeConnection } from "@/hooks/useOpenEyeConnection";
import { OpenEyeWebSocket } from "@/lib/openeye-ws";
import {
  Brain,
  Target,
  Eye,
  Zap,
  Send,
  RotateCcw,
  Activity,
} from "lucide-react";
import type { AgenticFrame } from "@/types/agentic";
import { PRESET_GOALS } from "./agentic/constants";
import { StatusCard } from "./agentic/StatusCard";
import { ActionPlanCard } from "./agentic/ActionPlanCard";
import { VLMReasoningCard } from "./agentic/VLMReasoningCard";
import { SafetyAlertsCard } from "./agentic/SafetyAlertsCard";
import { ObjectMemoryCard } from "./agentic/ObjectMemoryCard";
import { ObservationTimeline } from "./agentic/ObservationTimeline";
import { ReasoningHistoryCard } from "./agentic/ReasoningHistoryCard";

interface AgenticLoopProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isStreaming: boolean;
}

export function AgenticLoop({ videoRef, isStreaming }: AgenticLoopProps) {
  const { serverUrl } = useOpenEyeConnection();

  const [connected, setConnected] = useState(false);
  const [running, setRunning] = useState(false);
  const [goal, setGoal] = useState("");
  const [goalInput, setGoalInput] = useState("");
  const goalRef = useRef(goal);
  const [latestFrame, setLatestFrame] = useState<AgenticFrame | null>(null);
  const [vlmHistory, setVlmHistory] = useState<Array<{ timestamp: number; description: string }>>([]);
  const [fps, setFps] = useState(0);


  const wsRef = useRef<OpenEyeWebSocket | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fpsCounter = useRef(new FpsCounter());

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

        setFps(fpsCounter.current.tick());

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
      const base64 = captureFrame(video, canvas);
      if (base64) ws.send(JSON.stringify({ frame: base64, goal: goalRef.current }));
    };

    intervalRef.current = setInterval(sendFrame, 150);
    setRunning(true);
  }, [videoRef]);

  const stopLoop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setRunning(false);
  }, []);

  const handleSetGoal = useCallback(() => {
    const newGoal = goalInput.trim();
    if (!newGoal) return;
    setGoal(newGoal);
    goalRef.current = newGoal;
    if (wsRef.current?.connected) {
      wsRef.current.send(JSON.stringify({ set_goal: newGoal, frame: "" }));
    }
  }, [goalInput]);

  useEffect(() => {
    if (isStreaming && !wsRef.current) {
      connectWs();
    }
    return () => {
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStreaming]);

  useEffect(() => {
    goalRef.current = goal;
  }, [goal]);

  useEffect(() => {
    return () => disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const detectionCount = latestFrame?.detections?.length ?? 0;
  const hasSafetyAlerts = (latestFrame?.safety_alerts?.length ?? 0) > 0;

  return (
    <div className="space-y-4">
      {/* Control Bar */}
      <Card className="border-terminal-green/20 bg-background/80 backdrop-blur">
        <CardContent className="pt-4 pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
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

      {/* Status HUD */}
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

      {/* Main Content Grid */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <ActionPlanCard frame={latestFrame} running={running} />
          <VLMReasoningCard frame={latestFrame} running={running} />
          <SafetyAlertsCard frame={latestFrame} />
        </div>

        <div className="space-y-4">
          {latestFrame?.scene_description && (
            <Card className="border-border/50">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 mb-2">
                  <Eye className="h-4 w-4 text-foreground/80" />
                  <span className="text-sm font-mono text-foreground/80">SCENE</span>
                </div>
                <p className="text-xs text-muted-foreground">{latestFrame.scene_description}</p>
              </CardContent>
            </Card>
          )}
          <ObjectMemoryCard frame={latestFrame} running={running} />
          <ObservationTimeline frame={latestFrame} running={running} />
          <ReasoningHistoryCard history={vlmHistory} />
        </div>
      </div>
    </div>
  );
}
