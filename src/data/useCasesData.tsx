import {
  Bot,
  Bug,
  Monitor,
  ShieldCheck,
  Cog,
  Eye,
  Brain,
  Workflow,
  ScanLine,
  MousePointer,
  LayoutGrid,
  Layers,
  Users,
  AlertTriangle,
  Package,
} from "lucide-react";
import safetyWorkspace from "@/assets/demo/safety-workspace.jpg";
import sceneKitchen from "@/assets/demo/scene-kitchen.jpg";
import sceneWarehouse from "@/assets/demo/scene-warehouse.jpg";

export interface UseCase {
  id: string;
  icon: React.ReactNode;
  overline: string;
  overlineColor: string;
  title: string;
  subtitle: string;
  description: string;
  image: string;
  scenarios: { icon: React.ReactNode; label: string; detail: string }[];
  terminalCommand: string;
  stats: { value: string; label: string }[];
}

export const useCases: UseCase[] = [
  {
    id: "robotics",
    icon: <Bot className="w-5 h-5" />,
    overline: "Robotics",
    overlineColor: "text-terminal-amber",
    title: "Perception layer for any robot.",
    subtitle:
      "Give robots real-time visual understanding — from warehouse floors to family kitchens.",
    description:
      "Robots operating in human environments need continuous spatial awareness. OpenEye provides a dual-layer perception pipeline — fast YOLO detection for real-time geometry and VLM reasoning for context-dependent understanding — so robots can see, reason, and act safely around people and objects.",
    image: safetyWorkspace,
    scenarios: [
      {
        icon: <ShieldCheck className="w-4 h-4" />,
        label: "Safety zone enforcement",
        detail:
          "Define danger and caution zones around robotic arms or AMRs. OpenEye monitors boundaries and can trigger halt signals when humans enter restricted areas.",
      },
      {
        icon: <Users className="w-4 h-4" />,
        label: "Human-robot coexistence",
        detail:
          "Real-time detection and tracking of people, pets, and obstacles in shared workspaces. Continuous spatial awareness for safer navigation.",
      },
      {
        icon: <AlertTriangle className="w-4 h-4" />,
        label: "Hazard identification",
        detail:
          "VLM-powered scene reasoning detects context-dependent risks — objects near edges, unexpected workspace changes, and environmental hazards.",
      },
      {
        icon: <Package className="w-4 h-4" />,
        label: "Scene graph for planning",
        detail:
          "Structured scene graphs with object positions, spatial relationships, and persistent IDs across frames — feeding directly into robot planners.",
      },
    ],
    terminalCommand:
      "$ openeye watch --safety --danger-m 0.5 --caution-m 1.5",
    stats: [
      { value: "Real-time", label: "Detection" },
      { value: "YOLO+VLM", label: "Dual layer" },
      { value: "24/7", label: "Monitoring" },
    ],
  },
  {
    id: "app-debugging",
    icon: <Bug className="w-5 h-5" />,
    overline: "Application Debugging",
    overlineColor: "text-red-400",
    title: "See what your application sees.",
    subtitle:
      "Use structured visual perception to debug UIs, detect visual regressions, and validate application state.",
    description:
      "Modern applications are visual — but most debugging tools are blind. OpenEye's perception pipeline can analyze screenshots and screen recordings to detect UI anomalies, verify layout correctness, and generate structured descriptions of what's on screen. Integrate it into CI pipelines or use it interactively during development.",
    image: sceneKitchen,
    scenarios: [
      {
        icon: <ScanLine className="w-4 h-4" />,
        label: "Visual regression detection",
        detail:
          "Feed screenshots through OpenEye's detection pipeline to identify UI elements that shifted, disappeared, or rendered incorrectly between builds.",
      },
      {
        icon: <LayoutGrid className="w-4 h-4" />,
        label: "Layout validation",
        detail:
          "Get structured JSON output describing every detected element's position and spatial relationships. Assert layout constraints programmatically.",
      },
      {
        icon: <Eye className="w-4 h-4" />,
        label: "VLM-powered UI analysis",
        detail:
          "Ask natural language questions about your application's visual state — \"Is the modal centered?\" \"Are all cards the same height?\" — and get structured answers.",
      },
      {
        icon: <Workflow className="w-4 h-4" />,
        label: "CI/CD integration",
        detail:
          "Run OpenEye as part of your test pipeline via CLI or REST API. Capture screenshots, analyze them, and fail builds on visual anomalies.",
      },
    ],
    terminalCommand:
      "$ openeye run screenshot.png --model yolov8 --format json",
    stats: [
      { value: "JSON", label: "Structured output" },
      { value: "CI/CD", label: "Pipeline-ready" },
      { value: "VLM", label: "Natural language" },
    ],
  },
  {
    id: "desktop-agents",
    icon: <Monitor className="w-5 h-5" />,
    overline: "Desktop Agents",
    overlineColor: "text-blue-400",
    title: "Eyes for computer-use agents.",
    subtitle:
      "Give desktop automation agents structured visual understanding of screens, windows, and UI elements.",
    description:
      "Computer-use agents need to see and understand desktop environments to click buttons, fill forms, and navigate applications. OpenEye converts screen captures into structured perception data — detected elements, spatial relationships, and natural language scene descriptions — so agents can reason about what's on screen and plan their next action.",
    image: sceneWarehouse,
    scenarios: [
      {
        icon: <MousePointer className="w-4 h-4" />,
        label: "UI element detection",
        detail:
          "Detect buttons, inputs, menus, and other interactive elements with bounding boxes. Agents know exactly where to click.",
      },
      {
        icon: <Brain className="w-4 h-4" />,
        label: "Screen understanding",
        detail:
          "VLM-powered scene descriptions turn complex desktop states into natural language context that LLM agents can reason over.",
      },
      {
        icon: <Layers className="w-4 h-4" />,
        label: "Multi-window awareness",
        detail:
          "Track elements across overlapping windows and desktop regions. Scene graphs maintain spatial relationships between UI components.",
      },
      {
        icon: <Cog className="w-4 h-4" />,
        label: "REST API for agent loops",
        detail:
          "Expose perception as a REST API via `openeye serve`. Agents call for screen analysis on demand — screenshot in, structured JSON out.",
      },
    ],
    terminalCommand: "$ openeye serve yolov8 --port 8000",
    stats: [
      { value: "REST", label: "API server" },
      { value: "JSON", label: "Structured output" },
      { value: "Any", label: "Agent framework" },
    ],
  },
];
