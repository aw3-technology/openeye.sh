import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
} from "react";
import { captureFrame, FpsCounter } from "@/lib/frame-capture";
import { OpenEyeWebSocket } from "@/lib/openeye-ws";
import { useOpenEyeConnection } from "./useOpenEyeConnection";
import { useStreamRecording } from "./useStreamRecording";
import type {
  PerceptionFrame,
  VLMReasoning,
  PerformanceMetrics,
  ZoneLevel,
  RecordedFrame,
} from "@/types/openeye";

type StreamMode = "live" | "replay" | "idle";

interface PerceptionStreamContextValue {
  isStreaming: boolean;
  latestFrame: PerceptionFrame | null;
  latestVLM: VLMReasoning | null;
  vlmLoading: boolean;
  metrics: PerformanceMetrics;
  overallSafetyState: ZoneLevel;
  haltActive: boolean;
  mode: StreamMode;
  isRecording: boolean;
  startStream: () => Promise<void>;
  stopStream: () => void;
  startRecording: () => void;
  stopRecording: () => void;
  loadRecording: (frames: RecordedFrame[]) => void;
  startReplay: () => void;
  stopReplay: () => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  replayCanvasRef: React.RefObject<HTMLCanvasElement | null>;
}

const defaultMetrics: PerformanceMetrics = { fps: 0, latency_ms: 0, frame_count: 0 };

const PerceptionStreamContext = createContext<PerceptionStreamContextValue | null>(null);

const VLM_INTERVAL_MS = 2500;
const FRAME_INTERVAL_MS = 100; // 10Hz
const STREAM_TIMEOUT_MS = 3000;

export function PerceptionStreamProvider({ children }: { children: ReactNode }) {
  const { serverUrl } = useOpenEyeConnection();

  const [isStreaming, setIsStreaming] = useState(false);
  const [latestFrame, setLatestFrame] = useState<PerceptionFrame | null>(null);
  const [latestVLM, setLatestVLM] = useState<VLMReasoning | null>(null);
  const [vlmLoading, setVlmLoading] = useState(false);
  const [metrics, setMetrics] = useState<PerformanceMetrics>(defaultMetrics);
  const [overallSafetyState, setOverallSafetyState] = useState<ZoneLevel>("safe");
  const [haltActive, setHaltActive] = useState(false);
  const [mode, setMode] = useState<StreamMode>("idle");
  const [isRecording, setIsRecording] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  // WebSocket refs
  const perceptionWsRef = useRef<OpenEyeWebSocket | null>(null);
  const vlmWsRef = useRef<OpenEyeWebSocket | null>(null);

  // Capture refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const vlmIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Metrics refs
  const fpsCounter = useRef(new FpsCounter());
  const frameCount = useRef(0);

  // Stream health
  const lastFrameTimeRef = useRef(0);
  const healthCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isStreamingRef = useRef(false);

  const deriveSafetyState = useCallback((frame: PerceptionFrame) => {
    let worst: ZoneLevel = "safe";
    let halt = false;
    for (const alert of frame.safety_alerts) {
      if (alert.halt_recommended) halt = true;
      if (alert.zone === "danger") worst = "danger";
      else if (alert.zone === "caution" && worst !== "danger") worst = "caution";
    }
    setOverallSafetyState(worst);
    setHaltActive(halt);
  }, []);

  const stopStream = useCallback(() => {
    isStreamingRef.current = false;
    setIsStreaming(false);
    setMode("idle");
    if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
    if (vlmIntervalRef.current) clearInterval(vlmIntervalRef.current);
    if (healthCheckRef.current) clearInterval(healthCheckRef.current);
    perceptionWsRef.current?.disconnect();
    vlmWsRef.current?.disconnect();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  // Recording + Replay (extracted hook)
  const recording = useStreamRecording({
    setLatestFrame,
    setLatestVLM,
    setMode,
    deriveSafetyState,
    stopStream,
  });

  const startStream = useCallback(async () => {
    stopStream();

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true });
    } catch (err) {
      const msg = err instanceof DOMException ? err.message : "Camera access failed";
      if (recording.startReplayFallback()) return;
      throw new Error(msg);
    }

    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      try { await videoRef.current.play(); } catch { /* autoplay blocked */ }
    }

    // Fast channel: perception
    const percWs = new OpenEyeWebSocket(serverUrl, "/ws/perception");
    perceptionWsRef.current = percWs;

    percWs.subscribe((data) => {
      const frame = data as PerceptionFrame;
      if (frame.objects !== undefined) {
        setLatestFrame(frame);
        deriveSafetyState(frame);
        lastFrameTimeRef.current = performance.now();
        frameCount.current++;
        setMetrics({
          fps: fpsCounter.current.tick(),
          latency_ms: frame.inference_ms,
          frame_count: frameCount.current,
        });

        recording.recordFrame(frame);
      }
    });

    percWs.connect();

    // Slow channel: VLM
    const vlmWs = new OpenEyeWebSocket(serverUrl, "/ws/vlm");
    vlmWsRef.current = vlmWs;

    vlmWs.subscribe((data) => {
      const vlm = data as VLMReasoning;
      if (vlm.description !== undefined) {
        recording.latestVLMRef.current = vlm;
        setLatestVLM(vlm);
        setVlmLoading(false);
      }
    });

    vlmWs.connect();

    // Canvas for frame capture
    if (!canvasRef.current) canvasRef.current = document.createElement("canvas");
    const canvas = canvasRef.current;

    // Fast channel: send frames at 10Hz
    frameIntervalRef.current = setInterval(() => {
      const video = videoRef.current;
      const base64 = video ? captureFrame(video, canvas) : null;
      if (base64 && percWs.connected) {
        recording.lastBase64Ref.current = base64;
        percWs.send(base64);
      }
    }, FRAME_INTERVAL_MS);

    // Slow channel: send frames every 2.5s
    vlmIntervalRef.current = setInterval(() => {
      const base64 = recording.lastBase64Ref.current;
      if (base64 && vlmWs.connected) {
        setVlmLoading(true);
        vlmWs.send(base64);
      }
    }, VLM_INTERVAL_MS);

    // Health check: auto-switch to replay if no frames for 3s
    lastFrameTimeRef.current = performance.now();
    healthCheckRef.current = setInterval(() => {
      if (performance.now() - lastFrameTimeRef.current > STREAM_TIMEOUT_MS && isStreamingRef.current) {
        recording.switchToReplay();
      }
    }, 1000);

    isStreamingRef.current = true;
    setIsStreaming(true);
    setMode("live");
    fpsCounter.current.reset();
    frameCount.current = 0;
  }, [serverUrl, stopStream, deriveSafetyState, recording]);

  const handleStartRecording = useCallback(() => {
    recording.startRecording();
    setIsRecording(true);
  }, [recording]);

  const handleStopRecording = useCallback(() => {
    recording.stopRecording();
    setIsRecording(false);
  }, [recording]);

  useEffect(() => {
    return () => {
      stopStream();
      recording.cleanupReplay();
    };
  }, [stopStream, recording]);

  return (
    <PerceptionStreamContext.Provider
      value={{
        isStreaming,
        latestFrame,
        latestVLM,
        vlmLoading,
        metrics,
        overallSafetyState,
        haltActive,
        mode,
        isRecording,
        startStream,
        stopStream,
        startRecording: handleStartRecording,
        stopRecording: handleStopRecording,
        loadRecording: recording.loadRecording,
        startReplay: recording.startReplay,
        stopReplay: recording.stopReplay,
        videoRef,
        replayCanvasRef: recording.replayCanvasRef,
      }}
    >
      {children}
    </PerceptionStreamContext.Provider>
  );
}

export function usePerceptionStream() {
  const ctx = useContext(PerceptionStreamContext);
  if (!ctx) throw new Error("usePerceptionStream must be used within PerceptionStreamProvider");
  return ctx;
}
