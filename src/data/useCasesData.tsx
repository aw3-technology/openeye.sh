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
      "Warehouses are high-throughput, high-risk environments where robots and humans constantly cross paths. OpenEye provides a continuous visual safety layer that detects zone violations, monitors workspace state, and can halt operations when hazards are detected.",
    scenarios: [
      {
        icon: <Users className="w-4 h-4" />,
        label: "Human-robot zone enforcement",
        detail:
          "Detect when workers enter robotic arm reach zones. Send halt signals to connected robot controllers.",
      },
      {
        icon: <Package className="w-4 h-4" />,
        label: "Workspace monitoring",
        detail:
          "VLM-powered analysis of workspace state — detect unexpected changes, misplaced objects, and potential hazards.",
      },
      {
        icon: <Truck className="w-4 h-4" />,
        label: "Object tracking",
        detail:
          "Track objects in real time with consistent IDs across frames for spatial awareness.",
      },
      {
        icon: <ScanLine className="w-4 h-4" />,
        label: "Safety zone monitoring",
        detail:
          "Define danger and caution zones. OpenEye monitors zone boundaries and flags violations.",
      },
    ],
    terminalCommand:
      "$ openeye watch --safety --danger-m 0.5 --caution-m 1.5",
    stats: [
      { value: "Real-time", label: "Detection" },
      { value: "YOLOv8", label: "Fast layer" },
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
      "Home robots operate around children, pets, and fragile objects. OpenEye helps them navigate with awareness.",
    description:
      "The home environment is unpredictable — a toddler runs into the room, a cat jumps on the counter, a glass sits near the table edge. OpenEye gives home robots continuous spatial awareness and safety reasoning so they can operate around families more safely.",
    scenarios: [
      {
        icon: <Baby className="w-4 h-4" />,
        label: "Person detection",
        detail:
          "Real-time detection of people in a robot's workspace. Can trigger slow-down or stop via connected controllers.",
      },
      {
        icon: <Dog className="w-4 h-4" />,
        label: "Pet awareness",
        detail:
          "Detects and tracks pets in real time using object detection models.",
      },
      {
        icon: <AlertTriangle className="w-4 h-4" />,
        label: "Hazard identification",
        detail:
          "Spots objects near edges, scene changes, and other context-dependent risks using VLM reasoning.",
      },
      {
        icon: <Flame className="w-4 h-4" />,
        label: "Scene understanding",
        detail:
          "Scene graph generation with spatial relationships between detected objects for contextual awareness.",
      },
    ],
    terminalCommand:
      "$ openeye watch --models yolov8,depth-anything --safety",
    stats: [
      { value: "Depth", label: "3D estimation" },
      { value: "VLM", label: "Context reasoning" },
      { value: "Local", label: "All on-device" },
    ],
  },
  {
    id: "agents",
    icon: <Bot className="w-5 h-5" />,
    overline: "Autonomous Agents",
    overlineColor: "text-blue-400",
    title: "Perception API for agent frameworks.",
    subtitle:
      "Give any LLM-based agent structured visual understanding of the physical world via CLI or REST API.",
    description:
      "Autonomous agents built on LangChain, CrewAI, or custom frameworks lack native perception. OpenEye provides a perception layer that converts camera feeds into structured JSON with objects, spatial relationships, and scene descriptions — the format agents need to reason and act.",
    scenarios: [
      {
        icon: <Brain className="w-4 h-4" />,
        label: "Scene graph as agent context",
        detail:
          "Feed structured JSON scene descriptions directly into agent prompts. Objects, positions, relationships — all typed.",
      },
      {
        icon: <Workflow className="w-4 h-4" />,
        label: "Action planning from perception",
        detail:
          'Structured perception output enables agents to plan actions grounded in what OpenEye actually sees.',
      },
      {
        icon: <Cog className="w-4 h-4" />,
        label: "REST API integration",
        detail:
          "Expose OpenEye as a REST API via `openeye serve`. Agents call perception on demand via HTTP.",
      },
      {
        icon: <Eye className="w-4 h-4" />,
        label: "Scene memory",
        detail:
          "Scene graph tracking with object persistence across frames for consistent spatial reasoning.",
      },
    ],
    terminalCommand:
      "$ openeye serve yolov8 --port 8000",
    stats: [
      { value: "JSON", label: "Structured output" },
      { value: "REST", label: "API server" },
      { value: "Any", label: "LLM framework" },
    ],
  },
];
