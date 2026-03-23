import { useCallback, useEffect, useRef, useState } from "react";
import { useOpenEyeConnection } from "@/hooks/useOpenEyeConnection";
import { OpenEyeWebSocket } from "@/lib/openeye-ws";
import type { AgenticDetection, AgenticFrame } from "./types";

interface UseAgenticLoopOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isStreaming: boolean;
  onDetections?: (detections: AgenticDetection[]) => void;
  onRunningChange?: (running: boolean) => void;
}

export function useAgenticLoop({
  videoRef,
  isStreaming,
  onDetections,
  onRunningChange,
}: UseAgenticLoopOptions) {
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

        // Push detections to parent for overlay
        onDetections?.(frame.detections ?? []);

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
  }, [serverUrl, onDetections]);

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
    onRunningChange?.(false);
  }, [onRunningChange]);

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
    onRunningChange?.(true);
  }, [videoRef, onRunningChange]);

  // Stop the loop
  const stopLoop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setRunning(false);
    onRunningChange?.(false);
  }, [onRunningChange]);

  // Set goal from input
  const handleSetGoal = useCallback(() => {
    const newGoal = goalInput.trim();
    if (!newGoal) return;
    setGoal(newGoal);
    goalRef.current = newGoal;
    if (wsRef.current?.connected) {
      wsRef.current.send(JSON.stringify({ set_goal: newGoal, frame: "" }));
    }
  }, [goalInput]);

  // Set a preset goal directly
  const setPresetGoal = useCallback((preset: string) => {
    setGoalInput(preset);
    setGoal(preset);
    goalRef.current = preset;
    if (wsRef.current?.connected) {
      wsRef.current.send(JSON.stringify({ set_goal: preset, frame: "" }));
    }
  }, []);

  // Start agent (connect if needed, then begin loop after short delay)
  const startAgent = useCallback(() => {
    if (!connected) connectWs();
    startTimeoutRef.current = setTimeout(startLoop, 300);
  }, [connected, connectWs, startLoop]);

  // Auto-connect when streaming starts
  useEffect(() => {
    if (isStreaming && !wsRef.current) {
      connectWs();
    }
    return () => {
      disconnect();
    };
  }, [isStreaming, connectWs, disconnect]);

  // Sync goal ref when goal state changes
  useEffect(() => {
    goalRef.current = goal;
  }, [goal]);

  // Cleanup on unmount
  useEffect(() => {
    return () => disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Derived
  const detectionCount = latestFrame?.detections?.length ?? 0;
  const hasSafetyAlerts = (latestFrame?.safety_alerts?.length ?? 0) > 0;
  const hasChangeAlerts = (latestFrame?.change_alerts?.length ?? 0) > 0;
  const hasSafetyZones = (latestFrame?.safety_zones?.length ?? 0) > 0;

  return {
    connected,
    running,
    goal,
    goalInput,
    setGoalInput,
    handleSetGoal,
    setPresetGoal,
    startAgent,
    stopLoop,
    latestFrame,
    vlmHistory,
    fps,
    totalFrames,
    detectionCount,
    hasSafetyAlerts,
    hasChangeAlerts,
    hasSafetyZones,
    isStreaming,
  };
}

export type AgenticLoopState = ReturnType<typeof useAgenticLoop>;
