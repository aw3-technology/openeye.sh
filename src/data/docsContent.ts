import { loadDocs } from "./docs-loader";

export type BlockType =
  | "paragraph"
  | "code"
  | "table"
  | "list"
  | "note"
  | "heading";

export interface DocBlock {
  type: BlockType;
  content?: string;
  items?: string[];
  language?: string;
  filename?: string;
  level?: 2 | 3;
  variant?: "info" | "warning" | "danger";
  columns?: string[];
  rows?: string[][];
}

export interface DocSection {
  id: string;
  title: string;
  blocks: DocBlock[];
}

export interface DocGroup {
  label: string;
  sections: DocSection[];
}

export const docsContent: DocGroup[] = loadDocs();
