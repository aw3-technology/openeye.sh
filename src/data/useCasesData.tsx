import {
  Factory,
  Home,
  Bot,
  Users,
  Package,
  Truck,
  ScanLine,
  Baby,
  Dog,
  AlertTriangle,
  Flame,
  Brain,
  Workflow,
  Cog,
  Eye,
} from "lucide-react";

export interface UseCase {
  id: string;
  icon: React.ReactNode;
  overline: string;
  overlineColor: string;
  title: string;
  subtitle: string;
  description: string;
  scenarios: { icon: React.ReactNode; label: string; detail: string }[];
  terminalCommand: string;
  stats: { value: string; label: string }[];
}

export const useCases: UseCase[] = [
  {
    id: "warehouse",
    icon: <Factory className="w-5 h-5" />,
    overline: "Industrial & Warehouse",
    overlineColor: "text-terminal-amber",
    title: "Safety layer for warehouse robotics.",
    subtitle:
      "Monitor autonomous mobile robots, robotic arms, and human workers sharing the same floor — in real time.",
    description:
      "Warehouses are high-throughput, high-risk environments where robots and humans constantly cross paths. OpenEye provides a continuous visual safety layer that detects zone violations, monitors load stability, and halts operations before collisions happen.",
    scenarios: [
      {
        icon: <Users className="w-4 h-4" />,
        label: "Human-robot zone enforcement",
        detail:
          "Detect when workers enter robotic arm reach zones. Sub-100ms halt signal via OpenClaw or ROS e-stop.",
      },
      {
        icon: <Package className="w-4 h-4" />,
        label: "Load stability monitoring",
        detail:
          "VLM-powered analysis of pallet stacks, conveyor belt loads, and forklift cargo for tip-over risk.",
      },
      {
        icon: <Truck className="w-4 h-4" />,
        label: "AMR path conflict detection",
        detail:
          "Track autonomous mobile robots in real time. Predict path intersections and reroute before deadlocks.",
      },
      {
        icon: <ScanLine className="w-4 h-4" />,
        label: "PPE compliance checks",
        detail:
          "Continuous verification of hard hats, vests, and safety glasses in designated zones using object detection.",
      },
    ],
    terminalCommand:
      '$ openeye watch --mode guardian --workspace "warehouse_floor" --zones "arm_1,arm_2,loading_bay"',
    stats: [
      { value: "<100ms", label: "Halt latency" },
      { value: "30fps", label: "Detection rate" },
      { value: "24/7", label: "Monitoring" },
    ],
  },
  {
    id: "home",
    icon: <Home className="w-5 h-5" />,
    overline: "Home Robotics",
    overlineColor: "text-terminal-green",
    title: "Safe robots in human spaces.",
    subtitle:
      "Home robots operate around children, pets, and fragile objects. OpenEye ensures they navigate with awareness.",
    description:
      "The home environment is unpredictable — a toddler runs into the room, a cat jumps on the counter, a glass sits near the table edge. OpenEye gives home robots continuous spatial awareness and safety reasoning so they can operate around families with confidence.",
    scenarios: [
      {
        icon: <Baby className="w-4 h-4" />,
        label: "Child and vulnerable person detection",
        detail:
          "Immediate detection of children, elderly, or anyone in a robot's path. Triggers slow-down or full stop.",
      },
      {
        icon: <Dog className="w-4 h-4" />,
        label: "Pet awareness",
        detail:
          "Detects and tracks pets in real time. Prevents collisions with animals that move unpredictably.",
      },
      {
        icon: <AlertTriangle className="w-4 h-4" />,
        label: "Hazard identification",
        detail:
          "Spots objects near edges, spills on floors, open cabinets, and other context-dependent risks using VLM reasoning.",
      },
      {
        icon: <Flame className="w-4 h-4" />,
        label: "Kitchen and appliance safety",
        detail:
          "Monitors stove states, detects hot surfaces, and prevents robots from interacting with dangerous appliances.",
      },
    ],
    terminalCommand:
      '$ openeye watch --mode guardian --workspace "kitchen" --halt-on "child,pet,hazard"',
    stats: [
      { value: "360°", label: "Spatial awareness" },
      { value: "VLM", label: "Context reasoning" },
      { value: "Zero", label: "Cloud dependency" },
    ],
  },
  {
    id: "agents",
    icon: <Bot className="w-5 h-5" />,
    overline: "Autonomous Agents",
    overlineColor: "text-blue-400",
    title: "Perception API for agent frameworks.",
    subtitle:
      "Give any LLM-based agent structured visual understanding of the physical world via CLI or gRPC.",
    description:
      "Autonomous agents built on LangChain, CrewAI, or custom frameworks lack native perception. OpenEye provides a drop-in perception layer that converts camera feeds into structured scene graphs, spatial relationships, and action affordances — exactly the format agents need to reason and act.",
    scenarios: [
      {
        icon: <Brain className="w-4 h-4" />,
        label: "Scene graph as agent context",
        detail:
          "Feed structured JSON scene descriptions directly into agent prompts. Objects, positions, relationships, hazards — all typed.",
      },
      {
        icon: <Workflow className="w-4 h-4" />,
        label: "Action planning from perception",
        detail:
          'Natural language goals like "clear the desk" become multi-step plans grounded in what OpenEye actually sees.',
      },
      {
        icon: <Cog className="w-4 h-4" />,
        label: "Tool-use integration",
        detail:
          "Expose OpenEye as a LangChain tool, MCP server, or gRPC service. Agents call perception on demand.",
      },
      {
        icon: <Eye className="w-4 h-4" />,
        label: "Persistent environment memory",
        detail:
          "Agents recall previous observations. OpenEye maintains spatial memory across sessions for consistent reasoning.",
      },
    ],
    terminalCommand:
      "$ openeye stream --grpc --format scene_graph --subscribe agent_01",
    stats: [
      { value: "JSON", label: "Structured output" },
      { value: "gRPC", label: "Streaming API" },
      { value: "Any", label: "LLM framework" },
    ],
  },
];
