/**
 * Minimal, dependency-free inline Markdown parser for the docs renderer.
 *
 * Produces a token tree (never HTML strings) that React renders as elements,
 * so doc content can't inject markup. Supports:
 *   `code` / ``code with ` inside``, **bold** / __bold__, *italic* / _italic_,
 *   [text](url "optional title"), and backslash escapes (\*, \`, \[, ...).
 * Anything unmatched is kept as literal text.
 */

export type InlineNode =
  | { type: "text"; value: string }
  | { type: "code"; value: string }
  | { type: "strong"; children: InlineNode[] }
  | { type: "em"; children: InlineNode[] }
  | { type: "link"; href: string; children: InlineNode[] };

const ESCAPABLE = new Set("\\`*_{}[]()#+-.!|<>~\"'".split(""));
const WORD = /[\p{L}\p{N}]/u;

/** Only http(s), mailto, and same-site relative/anchor URLs become links. */
export function safeHref(raw: string): string | null {
  const href = raw.trim();
  if (!href) return null;
  if (href.startsWith("//")) return null;
  if (/^[/#?]/.test(href) || href.startsWith("./") || href.startsWith("../")) return href;
  if (/^(https?:|mailto:)/i.test(href)) return href;
  return null;
}

/** Index of the end of a backtick code span starting at `i`, or -1. */
function codeSpanEnd(s: string, i: number): { end: number; ticks: number } | null {
  let ticks = 0;
  while (s[i + ticks] === "`") ticks++;
  const fence = "`".repeat(ticks);
  let j = i + ticks;
  while (j < s.length) {
    const k = s.indexOf(fence, j);
    if (k === -1) return null;
    // the closing run must be exactly `ticks` long
    let run = 0;
    while (s[k + run] === "`") run++;
    if (run === ticks) return { end: k, ticks };
    j = k + run;
  }
  return null;
}

/**
 * Find the next occurrence of `delim` at or after `from`, skipping escapes and
 * code spans. For single-char delimiters, ignore positions that are part of a
 * doubled delimiter (so `*a **b** c*` closes at the last `*`).
 */
function findClosing(s: string, from: number, delim: string): number {
  let i = from;
  while (i < s.length) {
    const ch = s[i];
    if (ch === "\\" && i + 1 < s.length) {
      i += 2;
      continue;
    }
    if (ch === "`") {
      const span = codeSpanEnd(s, i);
      if (span) {
        i = span.end + span.ticks;
        continue;
      }
      let run = 0;
      while (s[i + run] === "`") run++;
      i += run;
      continue;
    }
    if (s.startsWith(delim, i)) {
      if (delim.length === 1) {
        const c = delim;
        if (s[i + 1] === c) {
          // skip over a doubled delimiter's matching pair, if any
          const inner = findClosing(s, i + 2, c + c);
          if (inner !== -1) {
            i = inner + 2;
            continue;
          }
          i += 2;
          continue;
        }
      }
      return i;
    }
    i++;
  }
  return -1;
}

/** Index of the `]` matching the `[` at `i` (nesting-aware), or -1. */
function findBracket(s: string, i: number): number {
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    const ch = s[j];
    if (ch === "\\") {
      j++;
      continue;
    }
    if (ch === "`") {
      const span = codeSpanEnd(s, j);
      if (span) {
        j = span.end + span.ticks - 1;
        continue;
      }
    }
    if (ch === "[") depth++;
    else if (ch === "]") {
      depth--;
      if (depth === 0) return j;
    }
  }
  return -1;
}

const LINK_TARGET = /^\(\s*(<[^>\n]*>|[^\s()]*(?:\([^\s()]*\)[^\s()]*)*)(?:\s+"[^"]*")?\s*\)/;

export function parseInline(input: string): InlineNode[] {
  const out: InlineNode[] = [];
  let buf = "";
  const flush = () => {
    if (buf) {
      const last = out[out.length - 1];
      if (last && last.type === "text") last.value += buf;
      else out.push({ type: "text", value: buf });
      buf = "";
    }
  };
  const push = (node: InlineNode) => {
    flush();
    out.push(node);
  };

  const s = input;
  let i = 0;
  while (i < s.length) {
    const ch = s[i];

    // Backslash escape
    if (ch === "\\" && i + 1 < s.length && ESCAPABLE.has(s[i + 1])) {
      buf += s[i + 1];
      i += 2;
      continue;
    }

    // Code span
    if (ch === "`") {
      const span = codeSpanEnd(s, i);
      if (span) {
        let value = s.slice(i + span.ticks, span.end);
        if (value.length > 1 && value.startsWith(" ") && value.endsWith(" ") && value.trim()) {
          value = value.slice(1, -1);
        }
        push({ type: "code", value });
        i = span.end + span.ticks;
        continue;
      }
      // unmatched run of backticks: literal
      let run = 0;
      while (s[i + run] === "`") run++;
      buf += s.slice(i, i + run);
      i += run;
      continue;
    }

    // Link
    if (ch === "[") {
      const close = findBracket(s, i);
      if (close !== -1) {
        const m = s.slice(close + 1).match(LINK_TARGET);
        if (m) {
          const rawHref = m[1].startsWith("<") ? m[1].slice(1, -1) : m[1];
          const href = safeHref(rawHref);
          const children = parseInline(s.slice(i + 1, close));
          if (href) push({ type: "link", href, children });
          else {
            // unsafe scheme: keep the label as plain inline content
            flush();
            out.push(...children);
          }
          i = close + 1 + m[0].length;
          continue;
        }
      }
      buf += ch;
      i++;
      continue;
    }

    // Emphasis
    if (ch === "*" || ch === "_") {
      const prev = i > 0 ? s[i - 1] : "";
      const double = s[i + 1] === ch;
      const delim = double ? ch + ch : ch;
      const after = s[i + delim.length] ?? "";
      // `_` inside words (snake_case, ENV_VARS) is never emphasis.
      const canOpen =
        after !== "" && !/\s/.test(after) && after !== ch && !(ch === "_" && WORD.test(prev));
      if (canOpen) {
        const close = findClosing(s, i + delim.length, delim);
        if (close !== -1) {
          const before = s[close - 1];
          const next = s[close + delim.length] ?? "";
          const canClose = !/\s/.test(before) && !(ch === "_" && WORD.test(next));
          if (canClose && close > i + delim.length) {
            const children = parseInline(s.slice(i + delim.length, close));
            push(double ? { type: "strong", children } : { type: "em", children });
            i = close + delim.length;
            continue;
          }
        }
      }
      buf += delim;
      i += delim.length;
      continue;
    }

    buf += ch;
    i++;
  }
  flush();
  return out;
}

/** Flatten inline Markdown to plain text (for meta descriptions, etc.). */
export function inlineToPlainText(input: string): string {
  const walk = (nodes: InlineNode[]): string =>
    nodes
      .map((n) => (n.type === "text" || n.type === "code" ? n.value : walk(n.children)))
      .join("");
  return walk(parseInline(input));
}

/**
 * Split a Markdown table row on unescaped `|` outside code spans.
 * `| a | b |` → ["a", "b"].
 */
export function splitTableRow(row: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let i = 0;
  const s = row.trim();
  while (i < s.length) {
    const ch = s[i];
    if (ch === "\\" && s[i + 1] === "|") {
      cell += "\\|";
      i += 2;
      continue;
    }
    if (ch === "`") {
      const span = codeSpanEnd(s, i);
      if (span) {
        cell += s.slice(i, span.end + span.ticks);
        i = span.end + span.ticks;
        continue;
      }
    }
    if (ch === "|") {
      cells.push(cell);
      cell = "";
      i++;
      continue;
    }
    cell += ch;
    i++;
  }
  cells.push(cell);
  // drop the empty edges produced by leading/trailing pipes
  if (s.startsWith("|")) cells.shift();
  if (s.endsWith("|") && !s.endsWith("\\|")) cells.pop();
  return cells.map((c) => c.trim());
}
