import type { HealthResponse, PerceptionFrame, PredictionResult, RuntimeConfig } from "@/types/openeye";
import { BaseApiClient } from "./base-api-client";
import { isCloudDeployment } from "./deployment-env";

const STORAGE_KEY = "openeye_server_url";

export function getStoredServerUrl(): string {
  return localStorage.getItem(STORAGE_KEY) || (isCloudDeployment() ? "" : "http://localhost:8000");
}

export function setStoredServerUrl(url: string) {
  localStorage.setItem(STORAGE_KEY, url);
}

export function isCloudUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.replace(/^\[|\]$/g, "");
    if (
      hostname === "localhost" ||
      hostname === "0.0.0.0" ||
      hostname === "::1" ||
      hostname.startsWith("127.") ||
      hostname.startsWith("10.") ||
      hostname.startsWith("192.168.") ||
      hostname.endsWith(".local")
    ) {
      return false;
    }
    // 172.16.0.0 – 172.31.255.255
    const m = hostname.match(/^172\.(\d+)\./);
    if (m && +m[1] >= 16 && +m[1] <= 31) return false;
    return true;
  } catch {
    return false;
  }
}

export class OpenEyeClient extends BaseApiClient {
  async health(): Promise<HealthResponse> {
    return this.request("/health", undefined, 5000);
  }

  async predict(file: File, prompt?: string): Promise<PredictionResult> {
    const form = new FormData();
    form.append("file", file);
    const qs = prompt ? `?prompt=${encodeURIComponent(prompt)}` : "";
    return this.request(`/predict${qs}`, { method: "POST", body: form });
  }

  async getConfig(): Promise<RuntimeConfig> {
    return this.request("/config");
  }

  async putConfig(config: RuntimeConfig): Promise<{ status: string }> {
    return this.request("/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
  }

  async vlmAnalyze(file: File, prompt?: string): Promise<VLMAnalyzeResult> {
    const form = new FormData();
    form.append("file", file);
    const qs = prompt ? `?prompt=${encodeURIComponent(prompt)}` : "";
    return this.request(`/vlm/analyze${qs}`, { method: "POST", body: form }, 35_000);
  }

  async perception(file: File): Promise<PerceptionFrame | PredictionResult> {
    const form = new FormData();
    form.append("file", file);
    return this.request("/perception", { method: "POST", body: form }, 15_000);
  }

  async nebiusStats(): Promise<NebiusStats> {
    return this.request("/nebius/stats", undefined, 5000);
  }
}

export interface VLMAnalyzeResult {
  raw: string;
  inference_ms: number;
  bugs?: Array<{
    type: string;
    description: string;
    severity: "high" | "medium" | "low";
    region?: { x: number; y: number; width: number; height: number };
  }>;
}

export interface NebiusStats {
  total_calls: number;
  total_tokens_estimated: number;
  total_latency_ms: number;
  avg_latency_ms: number;
  errors: number;
  last_call_at: number | null;
  model: string;
  provider: string;
  configured: boolean;
  uptime_seconds: number;
}
