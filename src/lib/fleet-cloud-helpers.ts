/**
 * Shared helpers for the cloud fleet client.
 */

import { supabase } from "@/integrations/supabase/client";

// Re-export mappers and row types from fleet-mappers
export {
  mapDevice,
  mapDeployment,
  mapDeploymentDeviceStatus,
  mapGroup,
  mapMaintenance,
  mapAlert,
  type Tables,
  type DeviceRow,
  type DeploymentRow,
  type DeploymentDeviceStatusRow,
  type DeviceGroupRow,
  type MaintenanceWindowRow,
  type FleetAlertRow,
} from "./fleet-mappers";

// ── Helpers ────────────────────────────────────────────────────

export async function getUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const uid = data.session?.user?.id;
  if (!uid) throw new Error("Not authenticated");
  return uid;
}

export function assertOk<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}
