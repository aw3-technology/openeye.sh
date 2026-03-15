import { useCallback, useRef } from "react";
import type {
  PerceptionFrame,
  VLMReasoning,
  RecordedFrame,
  ZoneLevel,
} from "@/types/openeye";
import { toast } from "sonner";

const MAX_RECORDING_FRAMES = 1800; // ~3 min at 10Hz
const FRAME_INTERVAL_MS = 100; // 10Hz

interface StreamRecordingCallbacks {
  setLatestFrame: (frame: PerceptionFrame) => void;
  setLatestVLM: (vlm: VLMReasoning) => void;
  setMode: (mode: "live" | "replay" | "idle") => void;
  deriveSafetyState: (frame: PerceptionFrame) => void;
  stopStream: () => void;
}

function drawReplayFrame(
  canvas: HTMLCanvasElement | null,
  base64: string,
) {
  if (!canvas || !base64) return;
  const img = new Image();
  img.onload = () => {
    const ctx = canvas.getContext("2d");
    if (ctx && canvas) {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
    }
  };
  img.src = `data:image/jpeg;base64,${base64}`;
}

export function useStreamRecording(callbacks: StreamRecordingCallbacks) {
  const { setLatestFrame, setLatestVLM, setMode, deriveSafetyState, stopStream } = callbacks;

  // Recording refs
  const recordingRef = useRef<RecordedFrame[]>([]);
  const isRecordingRef = useRef(false);
  const lastBase64Ref = useRef<string>("");
  const latestVLMRef = useRef<VLMReasoning | null>(null);

  // Replay refs
  const replayFramesRef = useRef<RecordedFrame[]>([]);
  const replayIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const replayIndexRef = useRef(0);
  const replayCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const playFrames = useCallback(
    (frames: RecordedFrame[], withCanvas: boolean) => {
      replayIndexRef.current = 0;
      replayIntervalRef.current = setInterval(() => {
        if (frames.length === 0) return;
        const idx = replayIndexRef.current % frames.length;
        const rf = frames[idx];
        setLatestFrame(rf.perception);
        if (rf.vlm) setLatestVLM(rf.vlm);
        deriveSafetyState(rf.perception);

        if (withCanvas && rf.frame_base64) {
          drawReplayFrame(replayCanvasRef.current, rf.frame_base64);
        }

        replayIndexRef.current = idx + 1;
      }, FRAME_INTERVAL_MS);
    },
    [setLatestFrame, setLatestVLM, deriveSafetyState],
  );

  const switchToReplay = useCallback(() => {
    if (recordingRef.current.length > 0) {
      toast.info("Camera lost — switching to replay mode");
      stopStream();
      replayFramesRef.current = [...recordingRef.current];
      setMode("replay");
      playFrames(replayFramesRef.current, true);
    } else {
      toast.error("Camera lost — no recording available for replay");
      stopStream();
    }
  }, [stopStream, setMode, playFrames]);

  const recordFrame = useCallback(
    (frame: PerceptionFrame) => {
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
    },
    [],
  );

  const startRecording = useCallback(() => {
    recordingRef.current = [];
    isRecordingRef.current = true;
  }, []);

  const stopRecording = useCallback(() => {
    isRecordingRef.current = false;
  }, []);

  const loadRecording = useCallback((frames: RecordedFrame[]) => {
    replayFramesRef.current = frames;
    recordingRef.current = frames;
  }, []);

  const startReplay = useCallback(() => {
    stopStream();
    const frames =
      replayFramesRef.current.length > 0
        ? replayFramesRef.current
        : recordingRef.current;
    if (frames.length === 0) {
      toast.error("No recording available");
      return;
    }
    replayFramesRef.current = frames;
    setMode("replay");
    playFrames(frames, true);
  }, [stopStream, setMode, playFrames]);

  const stopReplay = useCallback(() => {
    if (replayIntervalRef.current) clearInterval(replayIntervalRef.current);
    setMode("idle");
  }, [setMode]);

  const startReplayFallback = useCallback(() => {
    if (replayFramesRef.current.length > 0) {
      toast.info("Camera unavailable — starting replay mode");
      setMode("replay");
      playFrames(replayFramesRef.current, false);
      return true;
    }
    return false;
  }, [setMode, playFrames]);

  const cleanupReplay = useCallback(() => {
    if (replayIntervalRef.current) clearInterval(replayIntervalRef.current);
  }, []);

  return {
    // Recording
    recordFrame,
    startRecording,
    stopRecording,
    loadRecording,
    lastBase64Ref,
    latestVLMRef,
    isRecordingRef,
    // Replay
    startReplay,
    stopReplay,
    switchToReplay,
    startReplayFallback,
    cleanupReplay,
    replayCanvasRef,
  };
}
