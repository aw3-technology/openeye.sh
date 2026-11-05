import type { DocBlock } from "./docsContent";
import { splitTableRow } from "@/lib/markdown-inline";

/**
 * Markdown → DocBlock[] for src/data/docs/*.md.
 *
 * Block-level only: inline Markdown (`code`, **bold**, *italic*, [links](…))
 * stays in the strings and is rendered by <InlineMarkdown> (lib/markdown-inline).
 */

/* ── Frontmatter ─────────────────────────────────────────────── */

export function parseFrontmatter(raw: string): { title: string; body: string } {
  const match = raw.replace(/\r\n/g, "\n").match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { title: "", body: raw };
  const fm = match[1];
  const body = match[2];
  const titleMatch = fm.match(/^title:\s*(.+)$/m);
  return { title: titleMatch ? titleMatch[1].trim() : "", body };
}

/* ── Line classifiers ────────────────────────────────────────── */

const FENCE = /^(\s*)```/;
const HEADING = /^(#{2,4})\s+(.*)$/;
const UL_ITEM = /^[-*+]\s+(.*)$/;
const OL_ITEM = /^(\d{1,9})[.)]\s+(.*)$/;
const QUOTE = /^>\s?(.*)$/;
const CALLOUT = /^\[!(info|note|tip|important|warning|caution|danger)\]\s*(.*)$/i;
const HR = /^(?:-{3,}|\*{3,}|_{3,})\s*$/;

const CALLOUT_VARIANT: Record<string, NonNullable<DocBlock["variant"]>> = {
  info: "info",
  note: "info",
  tip: "info",
  important: "info",
  warning: "warning",
  caution: "danger",
  danger: "danger",
};

function startsBlock(line: string): boolean {
  return (
    FENCE.test(line) ||
    HEADING.test(line) ||
    line.startsWith("|") ||
    UL_ITEM.test(line) ||
    OL_ITEM.test(line) ||
    QUOTE.test(line) ||
    HR.test(line)
  );
}

/* ── Parser ──────────────────────────────────────────────────── */

export function parseMarkdown(md: string): DocBlock[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const blocks: DocBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      i++;
      continue;
    }

    // Fenced code block (may be indented, e.g. inside a list item)
    const fence = line.match(FENCE);
    if (fence) {
      const indent = fence[1].length;
      const meta = line.trim().slice(3).trim();
      const fmatch = meta.match(/^(\S+?)(?:\s+\{(.+)\})?$/);
      const language = fmatch ? fmatch[1] : undefined;
      const filename = fmatch ? fmatch[2] : undefined;
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) {
        const l = lines[i];
        // strip the fence's indentation, but never non-space content
        const lead = l.length - l.trimStart().length;
        codeLines.push(l.slice(Math.min(indent, lead)));
        i++;
      }
      i++; // closing ```
      blocks.push({
        type: "code",
        content: codeLines.join("\n"),
        ...(language && { language }),
        ...(filename && { filename }),
      });
      continue;
    }

    // Heading (## → h2, ### and #### → h3)
    const heading = line.match(HEADING);
    if (heading) {
      blocks.push({
        type: "heading",
        content: heading[2].trim(),
        level: heading[1].length === 2 ? 2 : 3,
      });
      i++;
      continue;
    }

    // Horizontal rule: no visual block in the docs theme, just a separator
    if (HR.test(line)) {
      i++;
      continue;
    }

    // Blockquote / callout: `> [!warning] text` (+ following `> ` lines)
    if (QUOTE.test(line)) {
      const quoted: string[] = [];
      while (i < lines.length && QUOTE.test(lines[i])) {
        const q = lines[i].match(QUOTE)![1];
        if (quoted.length > 0 && CALLOUT.test(q)) break; // next callout starts a new note
        quoted.push(q);
        i++;
      }
      let variant: NonNullable<DocBlock["variant"]> = "info";
      const callout = quoted[0].match(CALLOUT);
      if (callout) {
        variant = CALLOUT_VARIANT[callout[1].toLowerCase()];
        quoted[0] = callout[2];
      }
      const content = quoted.map((q) => q.trim()).filter(Boolean).join(" ");
      if (content) blocks.push({ type: "note", content, variant });
      continue;
    }

    // Table
    if (line.startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      const columns = splitTableRow(tableLines[0]);
      const hasSeparator = tableLines[1] !== undefined && /^\|[\s:|-]+\|?\s*$/.test(tableLines[1]);
      const rows = tableLines.slice(hasSeparator ? 2 : 1).map(splitTableRow);
      blocks.push({ type: "table", columns, rows });
      continue;
    }

    // Lists (unordered `- ` / `* ` / `+ `, ordered `1. ` / `1) `)
    const ol = line.match(OL_ITEM);
    if (ol || UL_ITEM.test(line)) {
      const ordered = !!ol;
      const itemRe = ordered ? OL_ITEM : UL_ITEM;
      const items: string[] = [];
      while (i < lines.length) {
        const m = lines[i].match(itemRe);
        if (m) {
          items.push((ordered ? m[2] : m[1]).trim());
          i++;
          continue;
        }
        const cur = lines[i];
        // Lazy/indented continuation of the previous item
        if (cur.trim() !== "" && /^\s+\S/.test(cur) && !FENCE.test(cur)) {
          items[items.length - 1] += ` ${cur.trim()}`;
          i++;
          continue;
        }
        // A blank line between items of the same kind keeps one (loose) list
        if (cur.trim() === "") {
          let j = i;
          while (j < lines.length && lines[j].trim() === "") j++;
          if (j < lines.length && itemRe.test(lines[j])) {
            i = j;
            continue;
          }
        }
        break;
      }
      blocks.push(
        ordered
          ? { type: "list", items, ordered: true, start: parseInt(ol![1], 10) }
          : { type: "list", items },
      );
      continue;
    }

    // Paragraph: consecutive lines until a blank line or another block starts
    const paraLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !startsBlock(lines[i])) {
      paraLines.push(lines[i].trim());
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push({ type: "paragraph", content: paraLines.join(" ") });
    } else {
      // Defensive: never stall on an unclassified line
      i++;
    }
  }

  return blocks;
}
