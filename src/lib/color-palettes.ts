/**
 * Centralized badge color classes for status indicators.
 * Eliminates duplication across governance, fleet, and dashboard components.
 */

/** Semantic badge styles — use for any status/severity badge. Keys are semantic names. */
export const badgeColors = {
  red: "bg-red-500/15 text-red-400 border-red-500/30",
  orange: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  amber: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  yellow: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  green: "bg-green-500/15 text-green-400 border-green-500/30",
  teal: "bg-teal-500/15 text-teal-400 border-teal-500/30",
  blue: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  cyan: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  purple: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  indigo: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
  gray: "bg-gray-500/15 text-gray-400 border-gray-500/30",
  criticalRed: "bg-red-600/20 text-red-300 border-red-600/40",
} as const;

export type BadgeColorKey = keyof typeof badgeColors;

/** Hex colors for confidence-based rendering (canvas/SVG). */
export const confidenceHex = {
  high: "#26c48e",
  medium: "#f59e0b",
  low: "#ef4444",
} as const;

/** Map a confidence value (0-1) to a hex color. */
export function confidenceToHex(confidence: number): string {
  if (confidence >= 0.7) return confidenceHex.high;
  if (confidence >= 0.4) return confidenceHex.medium;
  return confidenceHex.low;
}
