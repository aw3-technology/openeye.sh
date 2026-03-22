export interface DataPoint {
  time: number;
  fps: number;
  latency: number;
  frames: number;
  detections: number;
}

export interface SessionStats {
  avgFps: number;
  minFps: number;
  maxFps: number;
  avgLatency: number;
  minLatency: number;
  maxLatency: number;
  p95Latency: number;
  totalDetections: number;
}

export { fpsColor, latencyColor, formatDuration } from "@/lib/format-utils";

export function computeStats(history: DataPoint[]): SessionStats {
  if (history.length === 0) {
    return { avgFps: 0, minFps: 0, maxFps: 0, avgLatency: 0, minLatency: 0, maxLatency: 0, p95Latency: 0, totalDetections: 0 };
  }

  const fpsValues = history.map((p) => p.fps);
  const latValues = history.map((p) => p.latency).filter((l) => l > 0);
  const sortedLat = [...latValues].sort((a, b) => a - b);

  return {
    avgFps: Math.round(fpsValues.reduce((a, b) => a + b, 0) / fpsValues.length),
    minFps: Math.min(...fpsValues),
    maxFps: Math.max(...fpsValues),
    avgLatency: latValues.length > 0 ? Math.round(latValues.reduce((a, b) => a + b, 0) / latValues.length) : 0,
    minLatency: latValues.length > 0 ? Math.round(Math.min(...latValues)) : 0,
    maxLatency: latValues.length > 0 ? Math.round(Math.max(...latValues)) : 0,
    p95Latency: sortedLat.length > 0 ? Math.round(sortedLat[Math.floor(sortedLat.length * 0.95)]) : 0,
    totalDetections: history.reduce((sum, p) => sum + p.detections, 0),
  };
}
