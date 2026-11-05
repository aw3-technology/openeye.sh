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

export interface DocEntry extends DocSection {
  group: string;
}

/** Every docs section in sidebar order, each served at /docs/:id. */
export const docEntries: DocEntry[] = docsContent.flatMap((g) =>
  g.sections.map((s) => ({ ...s, group: g.label })),
);

export function getDocEntry(id: string): DocEntry | undefined {
  return docEntries.find((d) => d.id === id);
}

/** First paragraph of a section, trimmed to a meta-description length. */
export function docDescription(entry: DocSection): string {
  const first = entry.blocks.find((b) => b.type === "paragraph")?.content ?? "";
  const text = first.replace(/`/g, "").trim() || `${entry.title} — OpenEye documentation.`;
  return text.length > 158 ? `${text.slice(0, 155).replace(/\s+\S*$/, "")}…` : text;
}
