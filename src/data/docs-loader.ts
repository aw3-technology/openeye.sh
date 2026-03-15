import { docsManifest } from "./docs-manifest";
import type { DocBlock, DocGroup } from "./docsContent";

/* ── Raw imports (Vite eager glob) ───────────────────────────── */

const modules = import.meta.glob<string>("./docs/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
});

/* ── Frontmatter parser ──────────────────────────────────────── */

function parseFrontmatter(raw: string): { title: string; body: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { title: "", body: raw };
  const fm = match[1];
  const body = match[2];
  const titleMatch = fm.match(/^title:\s*(.+)$/m);
  return { title: titleMatch ? titleMatch[1].trim() : "", body };
}

/* ── Markdown → DocBlock[] parser ────────────────────────────── */

function parseMarkdown(md: string): DocBlock[] {
  const lines = md.split("\n");
  const blocks: DocBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Skip blank lines
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Fenced code block
    if (line.startsWith("```")) {
      const meta = line.slice(3).trim();
      // Parse language and optional {filename}
      const fmatch = meta.match(/^(\S+?)(?:\s+\{(.+)\})?$/);
      const language = fmatch ? fmatch[1] : undefined;
      const filename = fmatch ? fmatch[2] : undefined;
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      blocks.push({
        type: "code",
        content: codeLines.join("\n"),
        ...(language && { language }),
        ...(filename && { filename }),
      });
      continue;
    }

    // Heading
    if (line.startsWith("### ")) {
      blocks.push({ type: "heading", content: line.slice(4), level: 3 });
      i++;
      continue;
    }
    if (line.startsWith("## ")) {
      blocks.push({ type: "heading", content: line.slice(3), level: 2 });
      i++;
      continue;
    }

    // Note (blockquote with admonition)
    const noteMatch = line.match(
      /^>\s*\[!(info|warning|danger)\]\s*(.+)$/,
    );
    if (noteMatch) {
      blocks.push({
        type: "note",
        content: noteMatch[2],
        variant: noteMatch[1] as "info" | "warning" | "danger",
      });
      i++;
      continue;
    }

    // Table (line starts with |)
    if (line.startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      // First line = headers, second = separator, rest = rows
      const parseRow = (row: string) =>
        row
          .split("|")
          .slice(1, -1)
          .map((c) => c.trim());
      const columns = parseRow(tableLines[0]);
      const rows = tableLines.slice(2).map(parseRow);
      blocks.push({ type: "table", columns, rows });
      continue;
    }

    // List (line starts with -)
    if (line.startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && lines[i].startsWith("- ")) {
        items.push(lines[i].slice(2));
        i++;
      }
      blocks.push({ type: "list", items });
      continue;
    }

    // Paragraph (collect consecutive non-blank, non-special lines)
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].startsWith("```") &&
      !lines[i].startsWith("### ") &&
      !lines[i].startsWith("## ") &&
      !lines[i].startsWith("|") &&
      !lines[i].startsWith("- ") &&
      !lines[i].match(/^>\s*\[!/)
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push({ type: "paragraph", content: paraLines.join(" ") });
    }
  }

  return blocks;
}

/* ── Assemble DocGroup[] from manifest + markdown files ──────── */

export function loadDocs(): DocGroup[] {
  const fileMap = new Map<string, string>();
  for (const [path, content] of Object.entries(modules)) {
    // path is like "./docs/installation.md"
    const id = path.replace("./docs/", "").replace(".md", "");
    fileMap.set(id, content);
  }

  return docsManifest.map((group) => ({
    label: group.label,
    sections: group.sections.map((id) => {
      const raw = fileMap.get(id);
      if (!raw) {
        console.warn(`[docs] Missing file for section "${id}"`);
        return { id, title: id, blocks: [] };
      }
      const { title, body } = parseFrontmatter(raw);
      return { id, title, blocks: parseMarkdown(body) };
    }),
  }));
}
