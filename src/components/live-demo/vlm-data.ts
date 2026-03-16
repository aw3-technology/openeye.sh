import sceneWorkshopImg from "@/assets/demo/scene-workshop.jpg";
import sceneKitchenImg from "@/assets/demo/scene-kitchen.jpg";
import sceneWarehouseImg from "@/assets/demo/scene-warehouse.jpg";

export interface VLMObject {
  label: string;
  confidence: number;
  bbox: { x: number; y: number; w: number; h: number };
}

export interface VLMScene {
  name: string;
  image: string;
  objects: VLMObject[];
  yoloTime: number;
  vlm: {
    description: string;
    reasoning: string;
    safety: "SAFE" | "CAUTION" | "DANGER";
    actions: { text: string; priority: "critical" | "high" | "medium" | "low" }[];
  };
}

export const vlmScenes: VLMScene[] = [
  {
    name: "Workshop",
    image: sceneWorkshopImg,
    objects: [
      { label: "robot_arm", confidence: 0.98, bbox: { x: 0.25, y: 0.1, w: 0.35, h: 0.6 } },
      { label: "person", confidence: 0.97, bbox: { x: 0.7, y: 0.05, w: 0.25, h: 0.8 } },
      { label: "screwdriver", confidence: 0.92, bbox: { x: 0.65, y: 0.4, w: 0.1, h: 0.25 } },
      { label: "circuit_board", confidence: 0.95, bbox: { x: 0.1, y: 0.55, w: 0.2, h: 0.15 } },
    ],
    yoloTime: 23,
    vlm: {
      description: "A robotic arm is positioned over a workbench alongside electronic components. A person is standing within the robot's operational zone, approximately 1.2 meters from the arm's reach envelope.",
      reasoning: "The human operator is within the safety perimeter during what appears to be an active assembly session. The screwdriver and circuit board indicate manual work in progress. Risk level: MODERATE \u2014 the person is close enough for the arm to make contact during a sweep motion.",
      safety: "CAUTION",
      actions: [
        { text: "Reduce arm speed to 30% (collaborative mode)", priority: "high" },
        { text: "Enable proximity force-limiting on joints 3\u20136", priority: "high" },
        { text: "Alert operator: you are within the safety perimeter", priority: "medium" },
      ],
    },
  },
  {
    name: "Kitchen",
    image: sceneKitchenImg,
    objects: [
      { label: "cup", confidence: 0.94, bbox: { x: 0.6, y: 0.3, w: 0.1, h: 0.15 } },
      { label: "knife", confidence: 0.89, bbox: { x: 0.15, y: 0.35, w: 0.05, h: 0.2 } },
      { label: "plate", confidence: 0.91, bbox: { x: 0.3, y: 0.45, w: 0.2, h: 0.1 } },
      { label: "apple", confidence: 0.96, bbox: { x: 0.45, y: 0.5, w: 0.08, h: 0.08 } },
      { label: "bottle", confidence: 0.93, bbox: { x: 0.75, y: 0.2, w: 0.08, h: 0.3 } },
    ],
    yoloTime: 19,
    vlm: {
      description: "A kitchen counter with everyday dining objects arranged in a meal-preparation layout. A knife is positioned near the counter edge beside a plate, with a cup and bottle further back.",
      reasoning: "The knife is oriented with the blade facing outward near the edge \u2014 this represents a potential hazard if the counter is bumped. The remaining objects are in stable positions with no immediate risk of falling or causing harm.",
      safety: "SAFE",
      actions: [
        { text: "Flag knife position as potential edge hazard", priority: "low" },
        { text: "Log scene for kitchen safety audit", priority: "low" },
      ],
    },
  },
  {
    name: "Warehouse",
    image: sceneWarehouseImg,
    objects: [
      { label: "forklift", confidence: 0.97, bbox: { x: 0.05, y: 0.2, w: 0.3, h: 0.6 } },
      { label: "person", confidence: 0.99, bbox: { x: 0.7, y: 0.1, w: 0.15, h: 0.7 } },
      { label: "pallet", confidence: 0.95, bbox: { x: 0.4, y: 0.5, w: 0.25, h: 0.2 } },
      { label: "hard_hat", confidence: 0.88, bbox: { x: 0.72, y: 0.08, w: 0.1, h: 0.1 } },
    ],
    yoloTime: 21,
    vlm: {
      description: "A warehouse floor with an active forklift transporting materials. A worker wearing a hard hat is standing in the adjacent aisle, within 3 meters of the forklift's travel path.",
      reasoning: "The forklift and person are in close operational proximity. While the worker has proper PPE (hard hat detected), the forklift's trajectory could intersect with the worker's position. This is a high-priority safety scenario requiring immediate intervention.",
      safety: "DANGER",
      actions: [
        { text: "HALT: Signal forklift operator \u2014 person in path", priority: "critical" },
        { text: "Activate aisle warning lights", priority: "high" },
        { text: "Log near-miss event for safety review", priority: "medium" },
      ],
    },
  },
];
