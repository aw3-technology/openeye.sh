import { useState, useCallback, useRef, useEffect } from "react";
import { OpenEyeWebSocket } from "@/lib/openeye-ws";
import { useOpenEyeConnection } from "./useOpenEyeConnection";
import type { VLMReasoning } from "@/types/openeye";

interface VLMStreamState {
  /** Latest VLM reasoning response */
  latestReasoning: VLMReasoning | null;
  /** Whether the VLM websocket is connected and actively streaming */
  isActive: boolean;
  /** Whether we are currently waiting for a VLM response */
  isPending: boolean;
  /** VLM inference latency in ms (from the response) */
  latencyMs: number;
  /** Start VLM stream -- requires a video element reference to capture frames from */
  start: (videoRef: React.RefObject<HTMLVideoElement | null>) => void;
  /** Stop VLM stream */
  stop: () => void;
}

const VLM_SEND_INTERVAL_MS = 3000; // Send a frame every 3 seconds

export function useVLMStream(): VLMStreamState {
  const { serverUrl } = useOpenEyeConnection();
  const [latestReasoning, setLatestReasoning] = useState<VLMReasoning | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [latencyMs, setLatencyMs] = useState(0);

  const wsRef = useRef<OpenEyeWebSocket | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoRefLocal = useRef<React.RefObject<HTMLVideoElement | null> | null>(null);
  const sendTimestampRef = useRef<number>(0);

  const stop = useCallback(() => {
    setIsActive(false);
    setIsPending(false);
    if (initTimeoutRef.current) {
      clearTimeout(initTimeoutRef.current);
      initTimeoutRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    wsRef.current?.disconnect();
    wsRef.current = null;
  }, []);

  const start = useCallback(
    (videoRef: React.RefObject<HTMLVideoElement | null>) => {
      stop();
      videoRefLocal.current = videoRef;

      const ws = new OpenEyeWebSocket(serverUrl, "/ws/vlm");
      wsRef.current = ws;

      ws.subscribe((data) => {
        const reasoning = data as VLMReasoning;
        if (reasoning.description || reasoning.reasoning) {
          setLatestReasoning(reasoning);
          setLatencyMs(reasoning.latency_ms ?? (performance.now() - sendTimestampRef.current));
          setIsPending(false);
        }
      });

      ws.onStatus(({ connected }) => {
        if (!connected) {
          setIsPending(false);
        }
      });

      ws.connect();

      // Canvas for frame capture
      if (!canvasRef.current) canvasRef.current = document.createElement("canvas");
      const canvas = canvasRef.current;

      const sendFrame = () => {
        const video = videoRefLocal.current?.current;
        if (!video || !ws.connected) return;
        if (video.videoWidth === 0 || video.videoHeight === 0) return;

        // Scale down for VLM to save bandwidth (640px wide max)
        const scale = Math.min(1, 640 / video.videoWidth);
        canvas.width = Math.round(video.videoWidth * scale);
        canvas.height = Math.round(video.videoHeight * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.6);
        const base64 = dataUrl.split(",")[1];
        ws.send(base64);
        sendTimestampRef.current = performance.now();
        setIsPending(true);
      };

      // Send first frame after a short delay to let websocket connect
      initTimeoutRef.current = setTimeout(() => {
        sendFrame();
        initTimeoutRef.current = null;
      }, 500);
      intervalRef.current = setInterval(sendFrame, VLM_SEND_INTERVAL_MS);
      setIsActive(true);
    },
    [serverUrl, stop],
  );

  useEffect(() => {
    return () => stop();
  }, [stop]);

  return {
    latestReasoning,
    isActive,
    isPending,
    latencyMs,
    start,
    stop,
  };
}
