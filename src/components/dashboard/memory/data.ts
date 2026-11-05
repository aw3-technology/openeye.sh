import { agentDemoTicks } from "@/data/agentDemoData";
import type { Observation } from "@/types/agent";

// Extract unique observations from demo data
export const demoObservations: Observation[] = agentDemoTicks
  .filter((t) => t.observation)
  .map((t) => t.observation!)
  .filter((obs, i, arr) => arr.findIndex((o) => o.id === obs.id) === i);

/** Unique tags across observations, sorted. */
export function tagsOf(observations: Observation[]): string[] {
  return Array.from(new Set(observations.flatMap((obs) => obs.tags))).sort();
}

/** Unique detected object labels across observations, sorted. */
export function labelsOf(observations: Observation[]): string[] {
  return Array.from(new Set(observations.flatMap((obs) => obs.detections.map((d) => d.label)))).sort();
}
