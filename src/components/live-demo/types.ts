export interface DemoDetectedObject {
  label: string;
  confidence: number;
  bbox: { x: number; y: number; w: number; h: number };
  color: "green" | "amber" | "red";
}

export interface DemoTab {
  id: string;
  label: string;
  icon: React.ElementType;
  description: string;
}
