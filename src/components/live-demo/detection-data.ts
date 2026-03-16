import type { DemoDetectedObject } from "./types";
import sceneWorkshopImg from "@/assets/demo/scene-workshop.jpg";
import sceneKitchenImg from "@/assets/demo/scene-kitchen.jpg";
import sceneWarehouseImg from "@/assets/demo/scene-warehouse.jpg";

export const sampleImages: {
  name: string;
  image: string;
  objects: DemoDetectedObject[];
}[] = [
  {
    name: "Workshop",
    image: sceneWorkshopImg,
    objects: [
      { label: "robot_arm", confidence: 0.98, bbox: { x: 0.25, y: 0.1, w: 0.35, h: 0.6 }, color: "green" },
      { label: "screwdriver", confidence: 0.92, bbox: { x: 0.65, y: 0.4, w: 0.1, h: 0.25 }, color: "amber" },
      { label: "circuit_board", confidence: 0.95, bbox: { x: 0.1, y: 0.55, w: 0.2, h: 0.15 }, color: "green" },
      { label: "person", confidence: 0.97, bbox: { x: 0.7, y: 0.05, w: 0.25, h: 0.8 }, color: "red" },
    ],
  },
  {
    name: "Kitchen",
    image: sceneKitchenImg,
    objects: [
      { label: "cup", confidence: 0.94, bbox: { x: 0.6, y: 0.3, w: 0.1, h: 0.15 }, color: "green" },
      { label: "plate", confidence: 0.91, bbox: { x: 0.3, y: 0.45, w: 0.2, h: 0.1 }, color: "green" },
      { label: "knife", confidence: 0.89, bbox: { x: 0.15, y: 0.35, w: 0.05, h: 0.2 }, color: "amber" },
      { label: "apple", confidence: 0.96, bbox: { x: 0.45, y: 0.5, w: 0.08, h: 0.08 }, color: "green" },
      { label: "bottle", confidence: 0.93, bbox: { x: 0.75, y: 0.2, w: 0.08, h: 0.3 }, color: "green" },
    ],
  },
  {
    name: "Warehouse",
    image: sceneWarehouseImg,
    objects: [
      { label: "forklift", confidence: 0.97, bbox: { x: 0.05, y: 0.2, w: 0.3, h: 0.6 }, color: "green" },
      { label: "pallet", confidence: 0.95, bbox: { x: 0.4, y: 0.5, w: 0.25, h: 0.2 }, color: "green" },
      { label: "person", confidence: 0.99, bbox: { x: 0.7, y: 0.1, w: 0.15, h: 0.7 }, color: "red" },
      { label: "hard_hat", confidence: 0.88, bbox: { x: 0.72, y: 0.08, w: 0.1, h: 0.1 }, color: "green" },
    ],
  },
];

export const uploadedImageDetections: DemoDetectedObject[] = [
  { label: "object_1", confidence: 0.93, bbox: { x: 0.12, y: 0.15, w: 0.28, h: 0.35 }, color: "green" },
  { label: "object_2", confidence: 0.87, bbox: { x: 0.52, y: 0.2, w: 0.22, h: 0.45 }, color: "green" },
  { label: "object_3", confidence: 0.79, bbox: { x: 0.3, y: 0.6, w: 0.35, h: 0.25 }, color: "amber" },
];
