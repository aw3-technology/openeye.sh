import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from "react";
import { captureFrame, FpsCounter } from "@/lib/frame-capture";
import { OpenEyeWebSocket } from "@/lib/openeye-ws";
import { useOpenEyeConnection } from "./useOpenEyeConnection";
import type { PredictionResult, ModelParameters, PerformanceMetrics } from "@/types/openeye";

/** Interval between frame captures sent to server (ms) */
const FRAME_SEND_INTERVAL_MS = 100;

interface StreamContextValue {
  isStreaming: boolean;
  latestResult: PredictionResult | null;
  metrics: PerformanceMetrics;
  modelParams: ModelParameters;
  setModelParams: (params: ModelParameters) => void;
  startStream: () => Promise<void>;
  stopStream: () => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

const defaultParams: ModelParameters = {
  confidence_threshold: 0.5,
  nms_threshold: 0.45,
  max_detections: 100,
  class_filter: [],
};

const defaultMetrics: PerformanceMetrics = { fps: 0, latency_ms: 0, frame_count: 0 };

const StreamContext = createContext<StreamContextValue | null>(null);

export function OpenEyeStreamProvider({ children }: { children: ReactNode }) {
  const { serverUrl } = useOpenEyeConnection();
  const [isStreaming, setIsStreaming] = useState(false);
  const [latestResult, setLatestResult] = useState<PredictionResult | null>(null);
  const [metrics, setMetrics] = useState<PerformanceMetrics>(defaultMetrics);
  const [modelParams, setModelParams] = useState<ModelParameters>(defaultParams);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const wsRef = useRef<OpenEyeWebSocket | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fpsCounter = useRef(new FpsCounter());
  const frameCount = useRef(0);

  const stopStream = useCallback(() => {
    setIsStreaming(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    wsRef.current?.disconnect();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const startStream = useCallback(async () => {
    stopStream();

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true });
    } catch (err) {
      const msg = err instanceof DOMException ? err.message : "Camera access failed";
      setLatestResult(null);
      throw new Error(msg);
    }

    streamRef.current = stream;
    try {
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch {
          // autoplay blocked — video will start on user interaction
        }
      }

      const ws = new OpenEyeWebSocket(serverUrl);
      wsRef.current = ws;

      ws.subscribe((data) => {
        const result = data as PredictionResult;
        if (result.objects) {
          setLatestResult(result);
          frameCount.current++;
          const latency = typeof result.inference_ms === "number" && Number.isFinite(result.inference_ms)
            ? result.inference_ms
            : 0;
          setMetrics({
            fps: fpsCounter.current.tick(),
            latency_ms: latency,
            frame_count: frameCount.current,
          });
        }
      });

      ws.connect();

      // Canvas for frame capture
      if (!canvasRef.current) canvasRef.current = document.createElement("canvas");
      const canvas = canvasRef.current;

      const sendFrame = () => {
        const video = videoRef.current;
        if (!video || !ws.connected || !streamRef.current) return;
        const base64 = captureFrame(video, canvas);
        if (base64) ws.send(base64);
      };

      intervalRef.current = setInterval(sendFrame, FRAME_SEND_INTERVAL_MS);
      setIsStreaming(true);
      fpsCounter.current.reset();
      frameCount.current = 0;
    } catch (err) {
      // Clean up the camera stream if setup fails after acquiring it
      stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      throw err;
    }
  }, [serverUrl, stopStream]);

  useEffect(() => {
    return () => stopStream();
  }, [stopStream]);

  return (
    <StreamContext.Provider
      value={{ isStreaming, latestResult, metrics, modelParams, setModelParams, startStream, stopStream, videoRef }}
    >
      {children}
    </StreamContext.Provider>
  );
}

export function useOpenEyeStream() {
  const ctx = useContext(StreamContext);
  if (!ctx) throw new Error("useOpenEyeStream must be used within OpenEyeStreamProvider");
  return ctx;
}
