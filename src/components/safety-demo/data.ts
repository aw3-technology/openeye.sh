import type { SafetyState, LogEntry, StateConfig, WorkspaceObject } from "./types";

export const stateConfig: Record<SafetyState, StateConfig> = {
  safe: {
    label: "SAFE",
    color: "terminal-green",
    border: "hsl(var(--terminal-green))",
    bg: "hsl(var(--terminal-green) / 0.05)",
  },
  warning: {
    label: "WARNING",
    color: "terminal-amber",
    border: "hsl(var(--terminal-amber))",
    bg: "hsl(var(--terminal-amber) / 0.05)",
  },
  danger: {
    label: "DANGER",
    color: "terminal-red",
    border: "hsl(var(--terminal-red))",
    bg: "hsl(var(--terminal-red) / 0.05)",
  },
};

export const logColorMap: Record<LogEntry["level"], string> = {
  info: "text-terminal-green",
  warning: "text-terminal-amber",
  danger: "text-terminal-red",
  action: "text-terminal-fg",
};

export const workspaceObjects: WorkspaceObject[] = [
  { name: "ROBOT_ARM", x: 35, y: 20, w: 30, h: 55 },
  { name: "RED_CUBE", x: 18, y: 55, w: 10, h: 12 },
  { name: "BLUE_CUP", x: 70, y: 45, w: 10, h: 14 },
  { name: "GREEN_BLOCK", x: 75, y: 65, w: 12, h: 10 },
];

export const HAND_SIZE = { w: 22, h: 20 };

export const scenario: { time: number; state: SafetyState; log: LogEntry }[] = [
  { time: 0, state: "safe", log: { time: "14:32:01", message: "System initialized. Monitoring workspace.", level: "info" } },
  { time: 1500, state: "safe", log: { time: "14:32:03", message: "Scene clear — 3 objects, 0 hazards.", level: "info" } },
  { time: 3000, state: "safe", log: { time: "14:32:05", message: "Robot executing: sort_objects routine.", level: "info" } },
  { time: 4500, state: "safe", log: { time: "14:32:07", message: "All objects accounted for. Status: SAFE.", level: "info" } },
  { time: 6000, state: "warning", log: { time: "14:32:08", message: "Motion detected at workspace boundary.", level: "warning" } },
  { time: 7000, state: "danger", log: { time: "14:32:09", message: "HUMAN HAND detected in workspace zone.", level: "danger" } },
  { time: 7200, state: "danger", log: { time: "14:32:09", message: "ACTION: Emergency halt — robot frozen.", level: "action" } },
  { time: 8500, state: "danger", log: { time: "14:32:10", message: "Waiting for workspace to clear...", level: "danger" } },
  { time: 10500, state: "warning", log: { time: "14:32:12", message: "Hand retreating from workspace zone.", level: "warning" } },
  { time: 11500, state: "safe", log: { time: "14:32:13", message: "Workspace clear. Resuming operations.", level: "info" } },
  { time: 13000, state: "safe", log: { time: "14:32:15", message: "Robot resumed: sort_objects routine.", level: "info" } },
  { time: 14500, state: "safe", log: { time: "14:32:17", message: "All objects accounted for. Status: SAFE.", level: "info" } },
];

export const CYCLE_DURATION = 16000;
