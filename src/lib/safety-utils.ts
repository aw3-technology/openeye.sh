import type { DetectedObject, ZoneLevel } from "@/types/openeye";
export { PERSON_DANGER_THRESHOLD, PERSON_CAUTION_THRESHOLD, LOW_CONFIDENCE_THRESHOLD, getPersonSafetyLevel } from "./safety-thresholds";
export type { SafetyLevel } from "./safety-thresholds";

/** Tailwind text classes for each safety/zone level. */
export const safetyLevelTextColor: Record<string, string> = {
  safe: "text-terminal-green",
  caution: "text-terminal-amber",
  danger: "text-red-400",
};

/** Tailwind text classes (terminal variant) for log entries. */
export const safetyLogColor: Record<string, string> = {
  safe: "text-terminal-green",
  caution: "text-terminal-amber",
  danger: "text-terminal-red",
};

/** HSL-based config for safety status indicators (borders, backgrounds). */
export const safetyStateConfig = {
  safe: {
    label: "SAFE",
    border: "hsl(var(--terminal-green))",
    bg: "hsl(var(--terminal-green) / 0.05)",
  },
  caution: {
    label: "CAUTION",
    border: "hsl(var(--terminal-amber))",
    bg: "hsl(var(--terminal-amber) / 0.05)",
  },
  danger: {
    label: "DANGER",
    border: "hsl(var(--terminal-red))",
    bg: "hsl(var(--terminal-red) / 0.05)",
  },
} as const;

/** Full safety zone info for bounding-box overlays on persons. */
export interface SafetyZoneInfo {
  level: "SAFE" | "CAUTION" | "DANGER";
  color: string;
  borderColor: string;
  bgColor: string;
  textColor: string;
}

/** Classify a detected person into a safety zone based on bbox height. */
export function getPersonSafetyZone(obj: DetectedObject): SafetyZoneInfo | null {
  if (obj.label.toLowerCase() !== "person") return null;

  if (obj.bbox.h > 0.6) {
    return {
      level: "DANGER",
      color: "text-terminal-red",
      borderColor: "border-terminal-red",
      bgColor: "bg-terminal-red/15",
      textColor: "bg-terminal-red text-primary-foreground",
    };
  }
  if (obj.bbox.h > 0.3) {
    return {
      level: "CAUTION",
      color: "text-terminal-amber",
      borderColor: "border-terminal-amber",
      bgColor: "bg-terminal-amber/15",
      textColor: "bg-terminal-amber text-primary-foreground",
    };
  }
  return {
    level: "SAFE",
    color: "text-terminal-green",
    borderColor: "border-terminal-green",
    bgColor: "bg-terminal-green/15",
    textColor: "bg-terminal-green text-primary-foreground",
  };
}

/** Determine the worst safety status across all detected objects. */
export function getOverallSafetyStatus(objects: DetectedObject[]): SafetyZoneInfo | null {
  let worst: SafetyZoneInfo | null = null;
  for (const obj of objects) {
    const zone = getPersonSafetyZone(obj);
    if (!zone) continue;
    if (!worst || zone.level === "DANGER" || (zone.level === "CAUTION" && worst.level === "SAFE")) {
      worst = zone;
    }
  }
  return worst;
}

/** Color FPS display based on value. */
export function fpsColor(fps: number): string {
  if (fps > 20) return "text-terminal-green";
  if (fps > 10) return "text-terminal-amber";
  return "text-red-400";
}

/** Map a distance in meters to a terminal color name for safety zones. */
export function distanceZoneColor(distanceM: number): string {
  if (distanceM < 0.5) return "terminal-red";
  if (distanceM < 1.5) return "terminal-amber";
  return "terminal-green";
}
