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

const MAX_RECORDING_FRAMES = 1800; // ~3 min at 10Hz
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
  const replayCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // WebSocket refs
  const perceptionWsRef = useRef<OpenEyeWebSocket | null>(null);
  const vlmWsRef = useRef<OpenEyeWebSocket | null>(null);

  // Capture refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const vlmIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Metrics refs
  const fpsBuffer = useRef<number[]>([]);
  const frameCount = useRef(0);

  // Recording refs
  const recordingRef = useRef<RecordedFrame[]>([]);
  const lastBase64Ref = useRef<string>("");
  const isRecordingRef = useRef(false);
  const latestVLMRef = useRef<VLMReasoning | null>(null);
  const isStreamingRef = useRef(false);

  // Replay refs
  const replayFramesRef = useRef<RecordedFrame[]>([]);
  const replayIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const replayIndexRef = useRef(0);

  // Stream health
  const lastFrameTimeRef = useRef(0);
  const healthCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  const switchToReplay = useCallback(() => {
    if (recordingRef.current.length > 0) {
      toast.info("Camera lost — switching to replay mode");
      stopStream();
      replayFramesRef.current = [...recordingRef.current];
      setMode("replay");

      replayIndexRef.current = 0;
      replayIntervalRef.current = setInterval(() => {
        const frames = replayFramesRef.current;
        if (frames.length === 0) return;
        const idx = replayIndexRef.current % frames.length;
        const rf = frames[idx];
        setLatestFrame(rf.perception);
        if (rf.vlm) setLatestVLM(rf.vlm);
        deriveSafetyState(rf.perception);

        // Draw to replay canvas
        if (replayCanvasRef.current && rf.frame_base64) {
          const img = new Image();
          img.onload = () => {
            const ctx = replayCanvasRef.current?.getContext("2d");
            if (ctx && replayCanvasRef.current) {
              replayCanvasRef.current.width = img.width;
              replayCanvasRef.current.height = img.height;
              ctx.drawImage(img, 0, 0);
            }
          };
          img.src = `data:image/jpeg;base64,${rf.frame_base64}`;
        }

        replayIndexRef.current = idx + 1;
      }, FRAME_INTERVAL_MS);
    } else {
      toast.error("Camera lost — no recording available for replay");
      stopStream();
    }
  }, [stopStream, deriveSafetyState]);

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
        replayIndexRef.current = 0;
        replayIntervalRef.current = setInterval(() => {
          const frames = replayFramesRef.current;
          if (frames.length === 0) return;
          const idx = replayIndexRef.current % frames.length;
          const rf = frames[idx];
          setLatestFrame(rf.perception);
          if (rf.vlm) setLatestVLM(rf.vlm);
          deriveSafetyState(rf.perception);
          replayIndexRef.current = idx + 1;
        }, FRAME_INTERVAL_MS);
        return;
      }
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
        const now = performance.now();
        fpsBuffer.current.push(now);
        if (fpsBuffer.current.length > 30) fpsBuffer.current.shift();
        const elapsed = fpsBuffer.current.length > 1
          ? (now - fpsBuffer.current[0]) / 1000
          : 1;
        setMetrics({
          fps: Math.round(fpsBuffer.current.length / elapsed),
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
    const vlmWs = new OpenEyeWebSocket(serverUrl, "/ws/vlm");
    vlmWsRef.current = vlmWs;

    vlmWs.subscribe((data) => {
      const vlm = data as VLMReasoning;
      if (vlm.description !== undefined) {
        latestVLMRef.current = vlm;
        setLatestVLM(vlm);
        setVlmLoading(false);
      }
    });

    vlmWs.connect();

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

    // Slow channel: send frames every 2.5s
    vlmIntervalRef.current = setInterval(() => {
      const base64 = lastBase64Ref.current;
      if (base64 && vlmWs.connected) {
        setVlmLoading(true);
        vlmWs.send(base64);
      }
    }, VLM_INTERVAL_MS);

    // Health check: auto-switch to replay if no frames for 3s
    lastFrameTimeRef.current = performance.now();
    healthCheckRef.current = setInterval(() => {
      if (performance.now() - lastFrameTimeRef.current > STREAM_TIMEOUT_MS && isStreamingRef.current) {
        switchToReplay();
      }
    }, 1000);

    isStreamingRef.current = true;
    setIsStreaming(true);
    setMode("live");
    fpsBuffer.current = [];
    frameCount.current = 0;
  }, [serverUrl, stopStream, deriveSafetyState, switchToReplay]);

  const startRecording = useCallback(() => {
    recordingRef.current = [];
    isRecordingRef.current = true;
    setIsRecording(true);
  }, []);

  const stopRecording = useCallback(() => {
    isRecordingRef.current = false;
    setIsRecording(false);
  }, []);

  const loadRecording = useCallback((frames: RecordedFrame[]) => {
    replayFramesRef.current = frames;
    recordingRef.current = frames;
  }, []);

  const startReplay = useCallback(() => {
    stopStream();
    const frames = replayFramesRef.current.length > 0
      ? replayFramesRef.current
      : recordingRef.current;
    if (frames.length === 0) {
      toast.error("No recording available");
      return;
    }
    replayFramesRef.current = frames;
    setMode("replay");
    replayIndexRef.current = 0;

    replayIntervalRef.current = setInterval(() => {
      const idx = replayIndexRef.current % replayFramesRef.current.length;
      const rf = replayFramesRef.current[idx];
      setLatestFrame(rf.perception);
      if (rf.vlm) setLatestVLM(rf.vlm);
      deriveSafetyState(rf.perception);

      if (replayCanvasRef.current && rf.frame_base64) {
        const img = new Image();
        img.onload = () => {
          const ctx = replayCanvasRef.current?.getContext("2d");
          if (ctx && replayCanvasRef.current) {
            replayCanvasRef.current.width = img.width;
            replayCanvasRef.current.height = img.height;
            ctx.drawImage(img, 0, 0);
          }
        };
        img.src = `data:image/jpeg;base64,${rf.frame_base64}`;
      }

      replayIndexRef.current = idx + 1;
    }, FRAME_INTERVAL_MS);
  }, [stopStream, deriveSafetyState]);

  const stopReplay = useCallback(() => {
    if (replayIntervalRef.current) clearInterval(replayIntervalRef.current);
    setMode("idle");
  }, []);

  useEffect(() => {
    return () => {
      stopStream();
      if (replayIntervalRef.current) clearInterval(replayIntervalRef.current);
    };
  }, [stopStream]);

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
        startRecording,
        stopRecording,
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
