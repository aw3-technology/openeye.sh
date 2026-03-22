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

export function fpsColor(fps: number): string {
  if (fps >= 20) return "text-terminal-green";
  if (fps >= 10) return "text-terminal-amber";
  return "text-red-400";
}

export function latencyColor(ms: number): string {
  if (ms <= 50) return "text-terminal-green";
  if (ms <= 150) return "text-terminal-amber";
  return "text-red-400";
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

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
