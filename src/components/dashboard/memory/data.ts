import { agentDemoTicks } from "@/data/agentDemoData";
import type { Observation } from "@/types/agent";

// Extract unique observations from demo data
export const demoObservations: Observation[] = agentDemoTicks
  .filter((t) => t.observation)
  .map((t) => t.observation!)
  .filter((obs, i, arr) => arr.findIndex((o) => o.id === obs.id) === i);

// Pre-compute all unique tags
export const allTags = Array.from(
  new Set(demoObservations.flatMap((obs) => obs.tags))
).sort();

// Pre-compute all unique detected object labels
export const allLabels = Array.from(
  new Set(demoObservations.flatMap((obs) => obs.detections.map((d) => d.label)))
).sort();
