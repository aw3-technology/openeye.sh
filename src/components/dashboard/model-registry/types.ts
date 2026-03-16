export interface ModelEntry {
  key: string;
  name: string;
  creator: string;
  task: string;
  category: string;
  categoryColor: string;
  adapter: string;
  role: string;
  description: string;
  status: "integrated" | "planned";
  downloaded: boolean;
  size_mb?: number;
  performance?: string;
  provider?: string;
  extras?: string;
}
