import { describe, it, expect } from "vitest";
import { parseFrontmatter, parseMarkdown } from "../docs-markdown";

describe("parseMarkdown", () => {
  it("parses an ordered list instead of collapsing it into a paragraph", () => {
    const md = "Steps:\n\n1. Install the CLI\n2. Pull `yolov8`\n3. Run it";
    expect(parseMarkdown(md)).toEqual([
      { type: "paragraph", content: "Steps:" },
      {
        type: "list",
        ordered: true,
        start: 1,
        items: ["Install the CLI", "Pull `yolov8`", "Run it"],
      },
    ]);
  });

  it("ends a paragraph when a numbered list starts on the next line", () => {
    const blocks = parseMarkdown("Do this:\n1. first\n2. second");
    expect(blocks.map((b) => b.type)).toEqual(["paragraph", "list"]);
  });

  it("keeps loose items (blank lines between) in one list and joins continuation lines", () => {
    const md = "1. first\n   continued\n\n2. second\n\n3) third";
    const [list] = parseMarkdown(md);
    expect(list).toMatchObject({ type: "list", ordered: true, items: ["first continued", "second", "third"] });
    expect(parseMarkdown("1) a\n2) b")[0]).toMatchObject({ ordered: true, items: ["a", "b"] });
  });

  it("preserves the start number when a code block splits a list", () => {
    const md = "1. Install\n\n```bash\npipx install openeye-sh\n```\n\n2. Pull a model";
    const blocks = parseMarkdown(md);
    expect(blocks).toEqual([
      { type: "list", ordered: true, start: 1, items: ["Install"] },
      { type: "code", content: "pipx install openeye-sh", language: "bash" },
      { type: "list", ordered: true, start: 2, items: ["Pull a model"] },
    ]);
  });

  it("strips indentation from fenced code nested under a list item", () => {
    const md = "1. Run:\n\n   ```bash\n   openeye run yolov8 a.jpg\n   ```";
    expect(parseMarkdown(md)[1]).toEqual({
      type: "code",
      content: "openeye run yolov8 a.jpg",
      language: "bash",
    });
  });

  it("parses unordered lists with -, * and + markers", () => {
    expect(parseMarkdown("- a\n- **b**")).toEqual([{ type: "list", items: ["a", "**b**"] }]);
    expect(parseMarkdown("* a\n* b")[0]).toMatchObject({ type: "list", items: ["a", "b"] });
    expect(parseMarkdown("**Bold** paragraph")[0]).toEqual({
      type: "paragraph",
      content: "**Bold** paragraph",
    });
  });

  it("keeps inline markdown in paragraph text for the renderer", () => {
    const md = "Get a key at [openrouter.ai/keys](https://openrouter.ai/keys)\nthen set `OPENROUTER_API_KEY`.";
    expect(parseMarkdown(md)).toEqual([
      {
        type: "paragraph",
        content: "Get a key at [openrouter.ai/keys](https://openrouter.ai/keys) then set `OPENROUTER_API_KEY`.",
      },
    ]);
  });

  it("still parses headings, fenced code with filename, tables and callouts", () => {
    const md = [
      "## Setup",
      "### Details",
      "```python {main.py}",
      "print('hi')",
      "```",
      "| Flag | Meaning |",
      "|------|---------|",
      "| `--a \\| b` | yes |",
      "> [!warning] Careful with `rm`",
      "> second line",
      "> [!danger] Boom",
    ].join("\n");
    expect(parseMarkdown(md)).toEqual([
      { type: "heading", content: "Setup", level: 2 },
      { type: "heading", content: "Details", level: 3 },
      { type: "code", content: "print('hi')", language: "python", filename: "main.py" },
      { type: "table", columns: ["Flag", "Meaning"], rows: [["`--a \\| b`", "yes"]] },
      { type: "note", variant: "warning", content: "Careful with `rm` second line" },
      { type: "note", variant: "danger", content: "Boom" },
    ]);
  });

  it("separates callouts divided by a blank line", () => {
    const blocks = parseMarkdown("> [!warning] one\n\n> [!danger] two");
    expect(blocks).toEqual([
      { type: "note", variant: "warning", content: "one" },
      { type: "note", variant: "danger", content: "two" },
    ]);
  });
});

describe("parseFrontmatter", () => {
  it("extracts the title and body", () => {
    expect(parseFrontmatter("---\ntitle: Quickstart\n---\nHello")).toEqual({
      title: "Quickstart",
      body: "Hello",
    });
  });
});
