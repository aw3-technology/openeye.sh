import type { DetectedObject } from "@/types/openeye";

export function parseObjects(json: string): DetectedObject[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export { latencyColor } from "@/lib/format-utils";

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
