import { useRef, useCallback } from "react";
import type { PerformanceMetrics } from "@/types/openeye";

const defaultMetrics: PerformanceMetrics = { fps: 0, latency_ms: 0, frame_count: 0 };

export function usePerceptionMetrics() {
  const fpsBuffer = useRef<number[]>([]);
  const frameCount = useRef(0);
  const lastFrameTimeRef = useRef(0);

  const reset = useCallback(() => {
    fpsBuffer.current = [];
    frameCount.current = 0;
    lastFrameTimeRef.current = 0;
  }, []);

  const recordFrame = useCallback((inferenceMs: number): PerformanceMetrics => {
    lastFrameTimeRef.current = performance.now();
    frameCount.current++;
    const now = performance.now();
    fpsBuffer.current.push(now);
    if (fpsBuffer.current.length > 30) fpsBuffer.current.shift();
    const elapsed =
      fpsBuffer.current.length > 1
        ? (now - fpsBuffer.current[0]) / 1000
        : 1;
    return {
      fps: Math.round(Math.max(0, fpsBuffer.current.length - 1) / elapsed),
      latency_ms: inferenceMs,
      frame_count: frameCount.current,
    };
  }, []);

  return { defaultMetrics, lastFrameTimeRef, reset, recordFrame };
}
