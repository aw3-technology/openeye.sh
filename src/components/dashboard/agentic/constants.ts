export const PRESET_GOALS = [
  "Pick up the red cup",
  "Navigate to the door",
  "Identify all hazards",
  "Find the nearest person",
  "Observe and describe the scene",
];

export const COLOR_STYLES: Record<string, { border: string; text: string }> = {
  "terminal-green": {
    border: "border-terminal-green/20",
    text: "text-terminal-green",
  },
  "terminal-amber": {
    border: "border-terminal-amber/20",
    text: "text-terminal-amber",
  },
  "terminal-red": {
    border: "border-terminal-red/20",
    text: "text-terminal-red",
  },
};

export function formatTimeAgo(ts: number): string {
  const seconds = Math.floor(Date.now() / 1000 - ts);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ago`;
}

export function priorityColor(priority: number): string {
  if (priority >= 0.8) return "text-terminal-red";
  if (priority >= 0.6) return "text-terminal-amber";
  return "text-terminal-green";
}

export function priorityBadge(priority: number): string {
  if (priority >= 0.8) return "destructive";
  if (priority >= 0.6) return "secondary";
  return "default";
}
