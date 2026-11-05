import { docsManifest } from "./docs-manifest";
import type { DocGroup } from "./docsContent";
import { parseFrontmatter, parseMarkdown } from "./docs-markdown";

/* ── Raw imports (Vite eager glob) ───────────────────────────── */

const modules = import.meta.glob<string>("./docs/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
});

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
