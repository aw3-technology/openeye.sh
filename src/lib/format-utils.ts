/**
 * Shared formatting and color utilities used across the dashboard.
 */

/** Relative time label, e.g. "3m ago", "2d ago". Falls back to date string for >7d. */
export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  if (isNaN(diff) || diff < 0) return "unknown";
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

/** Format a number of seconds into a compact duration string, e.g. "3m 12s". */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

/** Format the elapsed time between two ISO date strings (or start → now). */
export function formatElapsed(startStr: string, endStr?: string | null): string {
  const start = new Date(startStr).getTime();
  const end = endStr ? new Date(endStr).getTime() : Date.now();
  const diff = end - start;
  if (isNaN(diff) || diff < 0) return "<1m";
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "<1m";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remainMins = mins % 60;
  if (hours < 24) return `${hours}h ${remainMins}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

/** Format the duration between two ISO date strings as a compact range label. */
export function formatDateRange(start: string, end: string): string {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

/** Tailwind text-color class based on latency threshold. */
export function latencyColor(ms: number): string {
  if (ms < 50) return "text-terminal-green";
  if (ms < 150) return "text-terminal-amber";
  return "text-red-400";
}

/** Tailwind text-color class based on FPS threshold. */
export function fpsColor(fps: number): string {
  if (fps >= 20) return "text-terminal-green";
  if (fps >= 10) return "text-terminal-amber";
  return "text-red-400";
}
