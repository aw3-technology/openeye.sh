import type { DetectedObject } from "@/types/openeye";

export function parseObjects(json: string): DetectedObject[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function latencyColor(ms: number) {
  if (ms < 50) return "text-green-500";
  if (ms < 150) return "text-yellow-500";
  return "text-red-500";
}

export function taskBadgeVariant(
  task: string,
): "default" | "secondary" | "outline" {
  switch (task) {
    case "detect":
      return "default";
    case "segment":
      return "secondary";
    default:
      return "outline";
  }
}
