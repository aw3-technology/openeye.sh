export { type AgenticDetection, type AgenticFrame } from "@/components/dashboard/agentic/types";
export type { NebiusStats } from "@/lib/openeye-client";

export type Phase = "SEE" | "THINK" | "ACT" | "PROTECT";

export const PHASES: Phase[] = ["SEE", "THINK", "ACT", "PROTECT"];

export const PHASE_ACTIVE_STYLES: Record<Phase, string> = {
  SEE: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-phase-pulse",
  THINK: "bg-amber-500/20 text-amber-400 border border-amber-500/40 animate-phase-pulse",
  ACT: "bg-blue-500/20 text-blue-400 border border-blue-500/40 animate-phase-pulse",
  PROTECT: "bg-red-500/20 text-red-400 border border-red-500/40 animate-phase-pulse",
};

export function detectPhase(
  isStreaming: boolean,
  hasVLM: boolean,
  hasGoal: boolean,
  hasDanger: boolean,
): Phase {
  if (hasDanger) return "PROTECT";
  if (hasGoal && hasVLM) return "ACT";
  if (hasVLM) return "THINK";
  return "SEE";
}
