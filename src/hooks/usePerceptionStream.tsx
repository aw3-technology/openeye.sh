import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
} from "react";
import { OpenEyeWebSocket } from "@/lib/openeye-ws";
import { useOpenEyeConnection } from "./useOpenEyeConnection";
import type {
  PerceptionFrame,
  VLMReasoning,
  PerformanceMetrics,
  ZoneLevel,
  RecordedFrame,
} from "@/types/openeye";
import { toast } from "sonner";
import { useRecording, MAX_RECORDING_FRAMES } from "./useRecording";
import { useReplay, FRAME_INTERVAL_MS } from "./useReplay";
import { useVLMChannel } from "./useVLMChannel";

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
const STREAM_TIMEOUT_MS = 3000;

export function PerceptionStreamProvider({ children }: { children: ReactNode }) {
  const { serverUrl } = useOpenEyeConnection();

  // --- Central state (single source of truth) ---
  const [isStreaming, setIsStreaming] = useState(false);
  const [latestFrame, setLatestFrame] = useState<PerceptionFrame | null>(null);
  const [latestVLM, setLatestVLM] = useState<VLMReasoning | null>(null);
  const [vlmLoading, setVlmLoading] = useState(false);
  const [metrics, setMetrics] = useState<PerformanceMetrics>(defaultMetrics);
  const [overallSafetyState, setOverallSafetyState] = useState<ZoneLevel>("safe");
  const [haltActive, setHaltActive] = useState(false);
  const [mode, setMode] = useState<StreamMode>("idle");
  const [isRecording, setIsRecording] = useState(false);

  // --- Refs that stay in the provider (stream orchestration) ---
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const perceptionWsRef = useRef<OpenEyeWebSocket | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fpsBuffer = useRef<number[]>([]);
  const frameCount = useRef(0);
  const isStreamingRef = useRef(false);
  const lastFrameTimeRef = useRef(0);
  const healthCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // --- Derived safety state (stays in provider — orchestrates state) ---
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

  // --- Sub-hooks ---
  const recording = useRecording({ setIsRecording });
  const { isRecordingRef, recordingRef, lastBase64Ref, latestVLMRef } = recording;

  const vlmChannel = useVLMChannel({ setLatestVLM, setVlmLoading, latestVLMRef });
  const { vlmWsRef, vlmIntervalRef, connectVLM, startVLMInterval } = vlmChannel;

  // stopStream needs to be defined before useReplay so it can be passed in
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
  }, [vlmIntervalRef, vlmWsRef]);

  const replay = useReplay({
    stopStream,
    deriveSafetyState,
    setLatestFrame,
    setLatestVLM,
    setMode,
    recordingRef,
  });
  const {
    replayCanvasRef,
    replayFramesRef,
    replayIntervalRef,
    switchToReplay,
    startReplay,
    stopReplay,
    startSimpleReplayInterval,
  } = replay;

  // --- startStream (orchestrates everything) ---
  const startStream = useCallback(async () => {
    stopStream();

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true });
    } catch (err) {
      const msg = err instanceof DOMException ? err.message : "Camera access failed";
      // Try replay fallback
      if (replayFramesRef.current.length > 0) {
        toast.info("Camera unavailable — starting replay mode");
        setMode("replay");
        startSimpleReplayInterval(replayFramesRef.current);
        return;
      }
      throw new Error(msg);
    }

    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      try {
        await videoRef.current.play();
      } catch {
        /* autoplay blocked */
      }
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
        const now = performance.now();
        fpsBuffer.current.push(now);
        if (fpsBuffer.current.length > 30) fpsBuffer.current.shift();
        const elapsed =
          fpsBuffer.current.length > 1
            ? (now - fpsBuffer.current[0]) / 1000
            : 1;
        setMetrics({
          fps: Math.round(Math.max(0, fpsBuffer.current.length - 1) / elapsed),
          latency_ms: frame.inference_ms,
          frame_count: frameCount.current,
        });

        // Record if active
        if (isRecordingRef.current && lastBase64Ref.current) {
          recordingRef.current.push({
            timestamp: Date.now(),
            frame_base64: lastBase64Ref.current,
            perception: frame,
            vlm: latestVLMRef.current,
          });
          if (recordingRef.current.length > MAX_RECORDING_FRAMES) {
            recordingRef.current.shift();
          }
        }
      }
    });

    percWs.connect();

    // Slow channel: VLM
    connectVLM(serverUrl);
    startVLMInterval(lastBase64Ref);

    // Canvas for frame capture
    if (!canvasRef.current) canvasRef.current = document.createElement("canvas");
    const canvas = canvasRef.current;

    const captureFrame = (): string | null => {
      const video = videoRef.current;
      if (!video || video.videoWidth === 0 || video.videoHeight === 0) return null;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
      return dataUrl.split(",")[1];
    };

    // Fast channel: send frames at 10Hz
    frameIntervalRef.current = setInterval(() => {
      const base64 = captureFrame();
      if (base64 && percWs.connected) {
        lastBase64Ref.current = base64;
        percWs.send(base64);
      }
    }, FRAME_INTERVAL_MS);

    // Health check: auto-switch to replay if no frames for 3s
    lastFrameTimeRef.current = performance.now();
    healthCheckRef.current = setInterval(() => {
      if (
        performance.now() - lastFrameTimeRef.current > STREAM_TIMEOUT_MS &&
        isStreamingRef.current
      ) {
        switchToReplay();
      }
    }, 1000);

    isStreamingRef.current = true;
    setIsStreaming(true);
    setMode("live");
    fpsBuffer.current = [];
    frameCount.current = 0;
  }, [
    serverUrl,
    stopStream,
    deriveSafetyState,
    switchToReplay,
    replayFramesRef,
    startSimpleReplayInterval,
    isRecordingRef,
    lastBase64Ref,
    recordingRef,
    latestVLMRef,
    connectVLM,
    startVLMInterval,
  ]);

  // --- loadRecording wrapper (needs replayFramesRef from replay hook) ---
  const loadRecording = useCallback(
    (frames: RecordedFrame[]) => {
      recording.loadRecording(frames, replayFramesRef);
    },
    [recording.loadRecording, replayFramesRef],
  );

  // --- Cleanup ---
  useEffect(() => {
    return () => {
      stopStream();
      if (replayIntervalRef.current) clearInterval(replayIntervalRef.current);
    };
  }, [stopStream, replayIntervalRef]);

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
        startRecording: recording.startRecording,
        stopRecording: recording.stopRecording,
        loadRecording,
        startReplay,
        stopReplay,
        videoRef,
        replayCanvasRef,
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
