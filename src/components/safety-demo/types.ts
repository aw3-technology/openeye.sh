export type SafetyState = "safe" | "warning" | "danger";

export interface LogEntry {
  time: string;
  message: string;
  level: "info" | "warning" | "danger" | "action";
}

export interface StateConfig {
  label: string;
  color: string;
  border: string;
  bg: string;
}

export interface WorkspaceObject {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
}
