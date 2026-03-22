import { useCallback, useRef } from "react";
import type { RecordedFrame, VLMReasoning } from "@/types/openeye";

export const MAX_RECORDING_FRAMES = 1800; // ~3 min at 10Hz

interface UseRecordingParams {
  setIsRecording: (v: boolean) => void;
}

export function useRecording({ setIsRecording }: UseRecordingParams) {
  const recordingRef = useRef<RecordedFrame[]>([]);
  const lastBase64Ref = useRef<string>("");
  const isRecordingRef = useRef(false);
  const latestVLMRef = useRef<VLMReasoning | null>(null);

  const startRecording = useCallback(() => {
    recordingRef.current = [];
    isRecordingRef.current = true;
    setIsRecording(true);
  }, [setIsRecording]);

  const stopRecording = useCallback(() => {
    isRecordingRef.current = false;
    setIsRecording(false);
  }, [setIsRecording]);

  const loadRecording = useCallback(
    (frames: RecordedFrame[], replayFramesRef: React.RefObject<RecordedFrame[]>) => {
      replayFramesRef.current = frames;
      recordingRef.current = frames;
    },
    [],
  );

  return {
    isRecordingRef,
    recordingRef,
    lastBase64Ref,
    latestVLMRef,
    startRecording,
    stopRecording,
    loadRecording,
  };
}
