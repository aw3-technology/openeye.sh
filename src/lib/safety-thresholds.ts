/**
 * Centralized safety thresholds for person proximity detection.
 *
 * These constants are used by MetricsBar and SafetyLog to determine
 * danger/caution/safe status based on the bounding box height of
 * detected persons (normalized 0-1 range relative to frame height).
 */

/** Person bbox height above which the status is DANGER (too close). */
export const PERSON_DANGER_THRESHOLD = 0.6;

/** Person bbox height above which the status is CAUTION (in proximity). */
export const PERSON_CAUTION_THRESHOLD = 0.3;

/** Confidence threshold below which a detection is flagged as caution. */
export const LOW_CONFIDENCE_THRESHOLD = 0.5;

export type SafetyLevel = "safe" | "caution" | "danger";

/**
 * Determine the safety level for a single person detection based on
 * their bounding box height.
 */
export function getPersonSafetyLevel(bboxHeight: number): SafetyLevel {
  if (bboxHeight > PERSON_DANGER_THRESHOLD) return "danger";
  if (bboxHeight > PERSON_CAUTION_THRESHOLD) return "caution";
  return "safe";
}
