import { useState, useCallback, useRef, useEffect } from "react";
import { captureFrame } from "@/lib/frame-capture";
import { OpenEyeWebSocket } from "@/lib/openeye-ws";
import { useOpenEyeConnection } from "./useOpenEyeConnection";
import type { DebugAnalysis } from "@/types/openeye";

interface DebugStreamState {
  /** Latest debug analysis from the server */
  latestAnalysis: DebugAnalysis | null;
  /** Rolling history of analyses */
  history: DebugAnalysis[];
  /** Whether the debug websocket is connected */
  isActive: boolean;
  /** Whether we are waiting for a response */
  isPending: boolean;
  /** Start debug stream — requires a video element to capture frames from */
  start: (videoRef: React.RefObject<HTMLVideoElement | null>) => void;
  /** Stop debug stream */
  stop: () => void;
}

const DEBUG_SEND_INTERVAL_MS = 5000; // Analyze every 5 seconds
const MAX_HISTORY = 50;

export function useDebugStream(): DebugStreamState {
  const { serverUrl } = useOpenEyeConnection();
  const [latestAnalysis, setLatestAnalysis] = useState<DebugAnalysis | null>(null);
  const [history, setHistory] = useState<DebugAnalysis[]>([]);
  const [isActive, setIsActive] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const wsRef = useRef<OpenEyeWebSocket | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoRefLocal = useRef<React.RefObject<HTMLVideoElement | null> | null>(null);

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

      const ws = new OpenEyeWebSocket(serverUrl, "/ws/debug");
      wsRef.current = ws;

      ws.subscribe((data) => {
        const analysis = data as DebugAnalysis;
        if (analysis.summary || analysis.issues) {
          setLatestAnalysis(analysis);
          setHistory((prev) => {
            const next = [...prev, analysis];
            return next.length > MAX_HISTORY ? next.slice(-MAX_HISTORY) : next;
          });
          setIsPending(false);
        }
      });

      ws.onStatus(({ connected }) => {
        if (!connected) setIsPending(false);
      });

      ws.connect();

      if (!canvasRef.current) canvasRef.current = document.createElement("canvas");
      const canvas = canvasRef.current;

      const sendFrame = () => {
        const video = videoRefLocal.current?.current;
        if (!video || !ws.connected) return;
        const base64 = captureFrame(video, canvas, { maxWidth: 1280 });
        if (!base64) return;
        ws.send(base64);
        setIsPending(true);
      };

      initTimeoutRef.current = setTimeout(() => {
        sendFrame();
        initTimeoutRef.current = null;
      }, 500);
      intervalRef.current = setInterval(sendFrame, DEBUG_SEND_INTERVAL_MS);
      setIsActive(true);
    },
    [serverUrl, stop],
  );

  useEffect(() => {
    return () => stop();
  }, [stop]);

  return {
    latestAnalysis,
    history,
    isActive,
    isPending,
    start,
    stop,
  };
}
