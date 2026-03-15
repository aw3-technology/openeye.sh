import { useState, useCallback, useRef, useEffect } from "react";
import { captureFrame, FpsCounter } from "@/lib/frame-capture";
import { OpenEyeWebSocket } from "@/lib/openeye-ws";
import { useOpenEyeConnection } from "./useOpenEyeConnection";
import type { DesktopPerceptionResult } from "@/types/openeye";

const FRAME_SEND_INTERVAL_MS = 2000; // Desktop: 0.5 FPS is enough

interface DesktopStreamState {
  isStreaming: boolean;
  latestResult: DesktopPerceptionResult | null;
  fps: number;
  frameCount: number;
}

export function useDesktopStream() {
  const { serverUrl } = useOpenEyeConnection();
  const [state, setState] = useState<DesktopStreamState>({
    isStreaming: false,
    latestResult: null,
    fps: 0,
    frameCount: 0,
  });

  const wsRef = useRef<OpenEyeWebSocket | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fpsCounter = useRef(new FpsCounter(10));
  const frameCount = useRef(0);

  const stopStream = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    wsRef.current?.disconnect();
    wsRef.current = null;
    setState((s) => ({ ...s, isStreaming: false }));
  }, []);

  const startStream = useCallback(
    (video: HTMLVideoElement) => {
      stopStream();
      videoRef.current = video;

      const ws = new OpenEyeWebSocket(serverUrl, "/ws/desktop");
      wsRef.current = ws;

      ws.subscribe((data) => {
        const result = data as DesktopPerceptionResult;
        if (result.type === "desktop_frame" || result.type === "desktop_find") {
          frameCount.current++;
          setState({
            isStreaming: true,
            latestResult: result,
            fps: fpsCounter.current.tick(),
            frameCount: frameCount.current,
          });
        }
      });

      ws.connect();

      // Canvas for frame capture
      if (!canvasRef.current)
        canvasRef.current = document.createElement("canvas");
      const canvas = canvasRef.current;

      const sendFrame = () => {
        const vid = videoRef.current;
        if (!vid || !ws.connected) return;
        const base64 = captureFrame(vid, canvas, { quality: 0.8 });
        if (base64) ws.send(JSON.stringify({ frame: base64 }));
      };

      intervalRef.current = setInterval(sendFrame, FRAME_SEND_INTERVAL_MS);
      setState((s) => ({ ...s, isStreaming: true }));
      fpsCounter.current.reset();
      frameCount.current = 0;
    },
    [serverUrl, stopStream],
  );

  const findElement = useCallback(
    (query: string) => {
      const vid = videoRef.current;
      if (!vid || !wsRef.current?.connected) return;
      if (!canvasRef.current)
        canvasRef.current = document.createElement("canvas");
      const base64 = captureFrame(vid, canvasRef.current, { quality: 0.8 });
      if (base64) wsRef.current.send(JSON.stringify({ frame: base64, query }));
    },
    [],
  );

  useEffect(() => {
    return () => stopStream();
  }, [stopStream]);

  return {
    ...state,
    startStream,
    stopStream,
    findElement,
  };
}
