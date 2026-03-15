/** Governance types — mirrors backend governance models. */

export type PolicyDomain = "robotics" | "desktop_agent" | "universal";
export type PolicyDecision = "allow" | "deny" | "modify" | "warn" | "audit_only";
export type Severity = "critical" | "high" | "medium" | "low" | "info";
export type Enforcement = "enforce" | "warn_only" | "audit_only";

export interface GovernanceResult {
  policy_name: string;
  decision: PolicyDecision;
  reason: string;
  severity: Severity;
  modifications: Record<string, unknown>;
  affected_objects: string[];
  metadata: Record<string, unknown>;
}

export interface GovernanceVerdict {
  overall_decision: PolicyDecision;
  results: GovernanceResult[];
  violations: GovernanceResult[];
  warnings: GovernanceResult[];
  denied_actions: string[];
  modifications: Record<string, unknown>;
  evaluation_ms: number;
  policies_evaluated: number;
}

export interface GovernanceStatus {
  active: boolean;
  config_name: string;
  domain: PolicyDomain;
  total_policies: number;
  enabled_policies: number;
  total_evaluations: number;
  total_violations: number;
  total_warnings: number;
  fail_open: boolean;
}

export interface PolicyInfo {
  name: string;
  type: string;
  domain: PolicyDomain;
  description: string;
  enabled: boolean;
  severity: Severity;
  enforcement: Enforcement;
  is_plugin: boolean;
}

export interface AuditEntry {
  timestamp: number;
  frame_id: number | null;
  policy_name: string;
  decision: PolicyDecision;
  reason: string;
  severity: Severity;
  affected_objects: string[];
  metadata: Record<string, unknown>;
}
