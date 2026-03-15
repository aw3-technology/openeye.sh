/** TypeScript mirrors of agentic pipeline models from cli/openeye_ai/schema.py. */

import type { DetectedObject, PredictionResult } from "./openeye";

export interface Observation {
  id: string;
  tick: number;
  timestamp: string;
  detections: DetectedObject[];
  scene_summary: string;
  change_description: string;
  significance: number; // 0-1
  tags: string[];
}

export interface AgentReasoning {
  observation_summary: string;
  memory_context: string;
  chain_of_thought: string;
  current_plan: string[];
  decided_action: string;
  plan_changed: boolean;
}

export interface AgentTickEvent {
  tick: number;
  phase: "perceive" | "recall" | "reason" | "act";
  prediction: PredictionResult | null;
  observation: Observation | null;
  reasoning: AgentReasoning | null;
  action_taken: string;
  memory_recalled: Observation[];
  current_plan: string[];
  timestamp: string;
}

export interface RecallQuery {
  query: string;
  time_range?: string | null;
  significance_min?: number;
  limit?: number;
}

export interface RecallResult {
  observations: Observation[];
  query: string;
  total_matches: number;
}

export interface AgentConfig {
  models: string;
  hz: number;
  llm: string;
  llm_model: string;
  goal: string;
}

export interface AgentStatus {
  running: boolean;
  tick_count: number;
  current_plan: string[];
  goal: string;
}
