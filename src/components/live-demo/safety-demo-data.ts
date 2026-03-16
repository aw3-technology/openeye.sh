export const safetyScenario = [
  { time: 0, state: "safe" as const, log: "[14:32:01] System initialized. Monitoring workspace.", objects: ["ROBOT_ARM", "RED_CUBE", "BLUE_CUP", "GREEN_BLOCK"], handVisible: false },
  { time: 2000, state: "safe" as const, log: "[14:32:03] Scene clear — 4 objects, 0 hazards.", objects: ["ROBOT_ARM", "RED_CUBE", "BLUE_CUP", "GREEN_BLOCK"], handVisible: false },
  { time: 4000, state: "safe" as const, log: "[14:32:05] Robot executing: sort_objects routine.", objects: ["ROBOT_ARM", "RED_CUBE", "BLUE_CUP", "GREEN_BLOCK"], handVisible: false },
  { time: 6000, state: "warning" as const, log: "[14:32:08] \u26a0 Motion detected at workspace boundary.", objects: ["ROBOT_ARM", "RED_CUBE", "BLUE_CUP", "GREEN_BLOCK"], handVisible: true },
  { time: 7500, state: "danger" as const, log: "[14:32:09] \ud83d\udd34 HUMAN HAND detected in workspace zone.", objects: ["ROBOT_ARM", "RED_CUBE", "BLUE_CUP", "GREEN_BLOCK", "HUMAN_HAND"], handVisible: true },
  { time: 8000, state: "danger" as const, log: "[14:32:09] ACTION: Emergency halt \u2014 robot frozen.", objects: ["ROBOT_ARM [HALTED]", "RED_CUBE", "BLUE_CUP", "GREEN_BLOCK", "HUMAN_HAND"], handVisible: true },
  { time: 10000, state: "danger" as const, log: "[14:32:10] Waiting for workspace to clear...", objects: ["ROBOT_ARM [HALTED]", "RED_CUBE", "BLUE_CUP", "GREEN_BLOCK", "HUMAN_HAND"], handVisible: true },
  { time: 12000, state: "warning" as const, log: "[14:32:12] Hand retreating from workspace zone.", objects: ["ROBOT_ARM [HALTED]", "RED_CUBE", "BLUE_CUP", "GREEN_BLOCK"], handVisible: false },
  { time: 13500, state: "safe" as const, log: "[14:32:13] \u2713 Workspace clear. Resuming operations.", objects: ["ROBOT_ARM", "RED_CUBE", "BLUE_CUP", "GREEN_BLOCK"], handVisible: false },
  { time: 15000, state: "safe" as const, log: "[14:32:15] Robot resumed: sort_objects routine.", objects: ["ROBOT_ARM", "RED_CUBE", "BLUE_CUP", "GREEN_BLOCK"], handVisible: false },
];

export const SAFETY_CYCLE = 17000;
