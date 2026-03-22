import { useCallback, useRef } from "react";
import type { PerceptionFrame, VLMReasoning, ZoneLevel, RecordedFrame } from "@/types/openeye";
import { toast } from "sonner";

export const FRAME_INTERVAL_MS = 100; // 10Hz

type StreamMode = "live" | "replay" | "idle";

interface UseReplayParams {
  stopStream: () => void;
  deriveSafetyState: (frame: PerceptionFrame) => void;
  setLatestFrame: (frame: PerceptionFrame) => void;
  setLatestVLM: (vlm: VLMReasoning) => void;
  setMode: (mode: StreamMode) => void;
  recordingRef: React.RefObject<RecordedFrame[]>;
}

export function useReplay({
  stopStream,
  deriveSafetyState,
  setLatestFrame,
  setLatestVLM,
  setMode,
  recordingRef,
}: UseReplayParams) {
  const replayFramesRef = useRef<RecordedFrame[]>([]);
  const replayIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const replayIndexRef = useRef(0);
  const replayCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const drawReplayFrame = useCallback(
    (rf: RecordedFrame) => {
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
    },
    [setLatestFrame, setLatestVLM, deriveSafetyState],
  );

  const startReplayInterval = useCallback(
    (frames: RecordedFrame[]) => {
      replayIndexRef.current = 0;
      replayIntervalRef.current = setInterval(() => {
        if (frames.length === 0) return;
        const idx = replayIndexRef.current % frames.length;
        drawReplayFrame(frames[idx]);
        replayIndexRef.current = idx + 1;
      }, FRAME_INTERVAL_MS);
    },
    [drawReplayFrame],
  );

  const switchToReplay = useCallback(() => {
    if (recordingRef.current.length > 0) {
      toast.info("Camera lost — switching to replay mode");
      stopStream();
      replayFramesRef.current = [...recordingRef.current];
      setMode("replay");
      startReplayInterval(replayFramesRef.current);
    } else {
      toast.error("Camera lost — no recording available for replay");
      stopStream();
    }
  }, [stopStream, setMode, recordingRef, startReplayInterval]);

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
    startReplayInterval(replayFramesRef.current);
  }, [stopStream, setMode, recordingRef, startReplayInterval]);

  const stopReplay = useCallback(() => {
    if (replayIntervalRef.current) clearInterval(replayIntervalRef.current);
    setMode("idle");
  }, [setMode]);

  /** Start a simple replay interval without drawing to canvas (fallback for camera-unavailable). */
  const startSimpleReplayInterval = useCallback(
    (frames: RecordedFrame[]) => {
      replayIndexRef.current = 0;
      replayIntervalRef.current = setInterval(() => {
        if (frames.length === 0) return;
        const idx = replayIndexRef.current % frames.length;
        const rf = frames[idx];
        setLatestFrame(rf.perception);
        if (rf.vlm) setLatestVLM(rf.vlm);
        deriveSafetyState(rf.perception);
        replayIndexRef.current = idx + 1;
      }, FRAME_INTERVAL_MS);
    },
    [setLatestFrame, setLatestVLM, deriveSafetyState],
  );

  return {
    replayCanvasRef,
    replayFramesRef,
    replayIntervalRef,
    replayIndexRef,
    startReplay,
    stopReplay,
    switchToReplay,
    startSimpleReplayInterval,
  };
}
