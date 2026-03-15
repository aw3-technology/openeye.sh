/**
 * Governance API client.
 * Extends BaseApiClient, targeting the OpenEye server (port 8000).
 */

import type {
  AuditEntry,
  GovernanceStatus,
  PolicyInfo,
} from "@/types/governance";
import { BaseApiClient } from "./base-api-client";

export class GovernanceClient extends BaseApiClient {
  // ── Status ──────────────────────────────────────────────────

  async getStatus(): Promise<GovernanceStatus> {
    return this.request("/governance/status");
  }

  // ── Policies ────────────────────────────────────────────────

  async listPolicies(): Promise<PolicyInfo[]> {
    return this.request("/governance/policies");
  }

  async listAvailablePolicies(): Promise<PolicyInfo[]> {
    return this.request("/governance/policies/available");
  }

  async enablePolicy(name: string): Promise<{ status: string; name: string }> {
    return this.request(`/governance/policies/${name}/enable`, { method: "POST" });
  }

  async disablePolicy(name: string): Promise<{ status: string; name: string }> {
    return this.request(`/governance/policies/${name}/disable`, { method: "POST" });
  }

  // ── Presets ─────────────────────────────────────────────────

  async listPresets(): Promise<string[]> {
    return this.request("/governance/presets");
  }

  async loadPreset(name: string): Promise<{ status: string; preset: string }> {
    return this.request(`/governance/presets/${name}/load`, { method: "POST" });
  }

  // ── Config ──────────────────────────────────────────────────

  async getConfig(): Promise<{ yaml: string }> {
    return this.request("/governance/config");
  }

  async updateConfig(yaml: string): Promise<{ status: string }> {
    return this.request("/governance/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ yaml }),
    });
  }

  // ── Audit ───────────────────────────────────────────────────

  async getAudit(limit = 100, offset = 0): Promise<AuditEntry[]> {
    return this.request(`/governance/audit?limit=${limit}&offset=${offset}`);
  }

  async getViolations(limit = 50): Promise<AuditEntry[]> {
    return this.request(`/governance/violations?limit=${limit}`);
  }
}
