/**
 * Shared helpers for the cloud fleet client.
 */

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
