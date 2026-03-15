export interface Model {
  name: string;
  creator: string;
  role: string;
  description: string;
  status: "integrated" | "planned";
  performance?: string;
  provider?: string;
}

export interface ModelGroup {
  category: string;
  color: string;
  heading: string;
  models: Model[];
}

export interface ProductionModel {
  name: string;
  role: string;
  stat: string;
}
