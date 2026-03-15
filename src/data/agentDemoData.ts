/** Scripted 20-tick demo scenario for the Agent Loop dashboard. */

import type { AgentTickEvent } from "@/types/agent";

function makeTick(
  tick: number,
  phase: "perceive" | "recall" | "reason" | "act",
  overrides: Partial<AgentTickEvent> = {}
): AgentTickEvent {
  return {
    tick,
    phase,
    prediction: null,
    observation: null,
    reasoning: null,
    action_taken: "",
    memory_recalled: [],
    current_plan: [],
    timestamp: new Date(Date.now() + tick * 2000).toISOString(),
    ...overrides,
  };
}

const desk = { label: "desk", confidence: 0.95, bbox: { x: 0.1, y: 0.3, w: 0.8, h: 0.6 } };
const laptop = { label: "laptop", confidence: 0.92, bbox: { x: 0.3, y: 0.35, w: 0.2, h: 0.15 } };
const cup = { label: "cup", confidence: 0.88, bbox: { x: 0.7, y: 0.4, w: 0.08, h: 0.12 } };
const person = { label: "person", confidence: 0.972, bbox: { x: 0.15, y: 0.1, w: 0.3, h: 0.8 } };
const screwdriver = { label: "screwdriver", confidence: 0.85, bbox: { x: 0.55, y: 0.45, w: 0.1, h: 0.05 } };
const solderingIron = { label: "soldering_iron", confidence: 0.91, bbox: { x: 0.6, y: 0.42, w: 0.12, h: 0.06 } };

const basePlan = ["Monitor for human entry", "Track object positions"];
const safetyPlan = ["Track person position", "Monitor hand proximity to tools", "Alert if hands near hazards"];
const hazardPlan = ["ALERT: Monitor soldering iron proximity", "Track hand distance to hot tools", "Warn if person reaches toward soldering iron", "Log hazard event"];
const unattendedPlan = ["Monitor for person return", "Track unattended soldering iron", "Alert if soldering iron left unattended > 5 min"];

export const agentDemoTicks: AgentTickEvent[] = [
  // Ticks 1-3: Empty desk scene
  ...([1, 2, 3] as const).map((tick) =>
    makeTick(tick, "act", {
      observation: {
        id: `obs-${tick}`,
        tick,
        timestamp: new Date(Date.now() + tick * 2000).toISOString(),
        detections: [desk, laptop, cup],
        scene_summary: "3 objects — desk, laptop, cup",
        change_description: "",
        significance: 0.1,
        tags: ["desk", "laptop", "cup"],
      },
      reasoning: {
        observation_summary: "Workspace with desk, laptop, and cup. No people.",
        memory_context: tick === 1 ? "No prior observations." : `Ticks 1-${tick - 1}: desk, laptop, cup. No changes.`,
        chain_of_thought: "Workspace is clear. Monitoring for human entry.",
        current_plan: basePlan,
        decided_action: "continue monitoring",
        plan_changed: tick === 1,
      },
      action_taken: "continue monitoring",
      current_plan: basePlan,
    })
  ),

  // Tick 4: PERCEIVE — person detected
  makeTick(4, "perceive", {
    observation: {
      id: "obs-4-p",
      tick: 4,
      timestamp: new Date(Date.now() + 4 * 2000).toISOString(),
      detections: [desk, laptop, cup, person],
      scene_summary: "4 objects — person detected (97.2%)",
      change_description: "appeared: person",
      significance: 0.8,
      tags: ["cup", "desk", "laptop", "person"],
    },
    current_plan: basePlan,
  }),

  // Tick 4: RECALL
  makeTick(4, "recall", {
    observation: {
      id: "obs-4-r",
      tick: 4,
      timestamp: new Date(Date.now() + 4 * 2000 + 500).toISOString(),
      detections: [desk, laptop, cup, person],
      scene_summary: "4 objects — person detected (97.2%)",
      change_description: "appeared: person",
      significance: 0.8,
      tags: ["cup", "desk", "laptop", "person"],
    },
    memory_recalled: [
      {
        id: "obs-3",
        tick: 3,
        timestamp: new Date(Date.now() + 3 * 2000).toISOString(),
        detections: [desk, laptop, cup],
        scene_summary: "3 objects — desk, laptop, cup",
        change_description: "",
        significance: 0.1,
        tags: ["desk", "laptop", "cup"],
      },
    ],
    current_plan: basePlan,
  }),

  // Tick 4: REASON
  makeTick(4, "reason", {
    reasoning: {
      observation_summary: "Person entered the workspace. 4 objects now visible.",
      memory_context: "Ticks 1-3: desk was empty with laptop and cup.",
      chain_of_thought: "Person entered workspace. Adjusting plan for safety monitoring. Need to track hand positions and proximity to tools.",
      current_plan: safetyPlan,
      decided_action: "update plan — person detected, switching to safety monitoring",
      plan_changed: true,
    },
    current_plan: safetyPlan,
  }),

  // Tick 4: ACT
  makeTick(4, "act", {
    observation: {
      id: "obs-4",
      tick: 4,
      timestamp: new Date(Date.now() + 4 * 2000 + 1500).toISOString(),
      detections: [desk, laptop, cup, person],
      scene_summary: "4 objects — person detected (97.2%)",
      change_description: "appeared: person",
      significance: 0.8,
      tags: ["cup", "desk", "laptop", "person"],
    },
    reasoning: {
      observation_summary: "Person entered the workspace. 4 objects now visible.",
      memory_context: "Ticks 1-3: desk was empty with laptop and cup.",
      chain_of_thought: "Person entered workspace. Adjusting plan for safety monitoring.",
      current_plan: safetyPlan,
      decided_action: "update plan — person detected, switching to safety monitoring",
      plan_changed: true,
    },
    action_taken: "update plan — person detected, switching to safety monitoring",
    current_plan: safetyPlan,
  }),

  // Ticks 5-8: Person working with tools
  ...([5, 6, 7, 8] as const).map((tick) =>
    makeTick(tick, "act", {
      observation: {
        id: `obs-${tick}`,
        tick,
        timestamp: new Date(Date.now() + tick * 2000).toISOString(),
        detections: [desk, laptop, person, screwdriver],
        scene_summary: "4 objects — person working with screwdriver",
        change_description: tick === 5 ? "appeared: screwdriver; disappeared: cup" : "",
        significance: tick === 5 ? 0.6 : 0.2,
        tags: ["desk", "laptop", "person", "screwdriver"],
      },
      reasoning: {
        observation_summary: "Person is working with tools at the desk.",
        memory_context: `Tick 4: person arrived. Now using screwdriver.`,
        chain_of_thought: "Person is handling tools safely. Screwdriver is within normal workspace zone.",
        current_plan: safetyPlan,
        decided_action: "continue monitoring — person working safely",
        plan_changed: false,
      },
      action_taken: "continue monitoring — person working safely",
      current_plan: safetyPlan,
    })
  ),

  // Tick 9: PERCEIVE — soldering iron appears
  makeTick(9, "perceive", {
    observation: {
      id: "obs-9-p",
      tick: 9,
      timestamp: new Date(Date.now() + 9 * 2000).toISOString(),
      detections: [desk, person, screwdriver, solderingIron],
      scene_summary: "4 objects — soldering iron near screwdriver (hazard zone)",
      change_description: "appeared: soldering_iron; disappeared: laptop",
      significance: 0.9,
      tags: ["desk", "person", "screwdriver", "soldering_iron"],
    },
    current_plan: safetyPlan,
  }),

  // Tick 9: REASON — hazard detected
  makeTick(9, "reason", {
    reasoning: {
      observation_summary: "Soldering iron detected near other tools — potential hazard.",
      memory_context: "Person has been working with screwdriver since tick 5. Now soldering iron appeared.",
      chain_of_thought: "HAZARD: Soldering iron detected near screwdriver. Person's hands are close to both tools. Need to raise alert level.",
      current_plan: hazardPlan,
      decided_action: "alert — soldering iron detected, elevated monitoring",
      plan_changed: true,
    },
    current_plan: hazardPlan,
  }),

  // Tick 9: ACT
  makeTick(9, "act", {
    observation: {
      id: "obs-9",
      tick: 9,
      timestamp: new Date(Date.now() + 9 * 2000 + 1500).toISOString(),
      detections: [desk, person, screwdriver, solderingIron],
      scene_summary: "4 objects — soldering iron near screwdriver (hazard zone)",
      change_description: "appeared: soldering_iron",
      significance: 0.9,
      tags: ["desk", "person", "screwdriver", "soldering_iron"],
    },
    reasoning: {
      observation_summary: "Soldering iron detected near other tools — potential hazard.",
      memory_context: "Person has been working with screwdriver since tick 5.",
      chain_of_thought: "HAZARD: Soldering iron detected near screwdriver.",
      current_plan: hazardPlan,
      decided_action: "alert — soldering iron detected, elevated monitoring",
      plan_changed: true,
    },
    action_taken: "alert — soldering iron detected near workspace, elevated monitoring",
    current_plan: hazardPlan,
  }),

  // Ticks 10-12: Monitoring hazard
  ...([10, 11, 12] as const).map((tick) =>
    makeTick(tick, "act", {
      observation: {
        id: `obs-${tick}`,
        tick,
        timestamp: new Date(Date.now() + tick * 2000).toISOString(),
        detections: [desk, person, screwdriver, solderingIron],
        scene_summary: "4 objects — person near hazardous tools",
        change_description: "",
        significance: 0.3,
        tags: ["desk", "person", "screwdriver", "soldering_iron"],
      },
      reasoning: {
        observation_summary: "Person continues working near soldering iron.",
        memory_context: "Soldering iron detected at tick 9. Person still present.",
        chain_of_thought: "Person is maintaining safe distance from soldering iron. Continuing elevated monitoring.",
        current_plan: hazardPlan,
        decided_action: "continue elevated monitoring",
        plan_changed: false,
      },
      action_taken: "continue elevated monitoring",
      current_plan: hazardPlan,
    })
  ),

  // Tick 13: Person leaves
  makeTick(13, "act", {
    observation: {
      id: "obs-13",
      tick: 13,
      timestamp: new Date(Date.now() + 13 * 2000).toISOString(),
      detections: [desk, screwdriver, solderingIron],
      scene_summary: "3 objects — person left workspace, tools remain",
      change_description: "disappeared: person",
      significance: 0.7,
      tags: ["desk", "screwdriver", "soldering_iron"],
    },
    reasoning: {
      observation_summary: "Person has left the workspace. Tools remain on desk including soldering iron.",
      memory_context: "Person was working since tick 4. Soldering iron appeared at tick 9. Person now gone.",
      chain_of_thought: "Person left workspace but soldering iron is still on desk. This could be a safety concern if the iron is still hot.",
      current_plan: unattendedPlan,
      decided_action: "update plan — person left, monitoring unattended tools",
      plan_changed: true,
    },
    action_taken: "update plan — person left, monitoring unattended tools",
    current_plan: unattendedPlan,
  }),

  // Ticks 14-16: Monitoring unattended tools
  ...([14, 15, 16] as const).map((tick) =>
    makeTick(tick, "act", {
      observation: {
        id: `obs-${tick}`,
        tick,
        timestamp: new Date(Date.now() + tick * 2000).toISOString(),
        detections: [desk, screwdriver, solderingIron],
        scene_summary: "3 objects — unattended tools on desk",
        change_description: "",
        significance: 0.2,
        tags: ["desk", "screwdriver", "soldering_iron"],
      },
      reasoning: {
        observation_summary: "Tools remain unattended on desk.",
        memory_context: "Person left at tick 13. Soldering iron unattended.",
        chain_of_thought: `Soldering iron unattended for ${tick - 13} ticks. Monitoring continues.`,
        current_plan: unattendedPlan,
        decided_action: "continue monitoring unattended tools",
        plan_changed: false,
      },
      action_taken: "continue monitoring unattended tools",
      current_plan: unattendedPlan,
    })
  ),

  // Tick 17: Scene clears
  makeTick(17, "act", {
    observation: {
      id: "obs-17",
      tick: 17,
      timestamp: new Date(Date.now() + 17 * 2000).toISOString(),
      detections: [desk, laptop],
      scene_summary: "2 objects — desk and laptop, workspace cleared",
      change_description: "disappeared: screwdriver, soldering_iron; appeared: laptop",
      significance: 0.5,
      tags: ["desk", "laptop"],
    },
    reasoning: {
      observation_summary: "Workspace cleared. Only desk and laptop remain.",
      memory_context: "Person worked ticks 4-12, left at tick 13. Tools now cleared.",
      chain_of_thought: "Workspace is clean and safe. All hazardous tools removed. Returning to standard monitoring.",
      current_plan: basePlan,
      decided_action: "reset plan — workspace clear, resuming standard monitoring",
      plan_changed: true,
    },
    action_taken: "reset plan — workspace clear, resuming standard monitoring",
    current_plan: basePlan,
  }),

  // Ticks 18-20: Back to monitoring
  ...([18, 19, 20] as const).map((tick) =>
    makeTick(tick, "act", {
      observation: {
        id: `obs-${tick}`,
        tick,
        timestamp: new Date(Date.now() + tick * 2000).toISOString(),
        detections: [desk, laptop, cup],
        scene_summary: "3 objects — desk, laptop, cup",
        change_description: tick === 18 ? "appeared: cup" : "",
        significance: tick === 18 ? 0.2 : 0.1,
        tags: ["cup", "desk", "laptop"],
      },
      reasoning: {
        observation_summary: "Workspace returned to initial state.",
        memory_context: "Full session: person worked ticks 4-12, hazard ticks 9-12, cleared at tick 17.",
        chain_of_thought: "Scene is back to baseline. Standard monitoring active.",
        current_plan: basePlan,
        decided_action: "continue monitoring",
        plan_changed: false,
      },
      action_taken: "continue monitoring",
      current_plan: basePlan,
    })
  ),
];
