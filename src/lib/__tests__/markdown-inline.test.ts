import { describe, it, expect } from "vitest";
import { inlineToPlainText, parseInline, safeHref, splitTableRow } from "../markdown-inline";

const t = (value: string) => ({ type: "text", value });

describe("parseInline", () => {
  it("returns plain text unchanged", () => {
    expect(parseInline("just words")).toEqual([t("just words")]);
  });

  it("parses inline code, keeping its contents literal", () => {
    expect(parseInline("run `openeye pull **yolov8**` now")).toEqual([
      t("run "),
      { type: "code", value: "openeye pull **yolov8**" },
      t(" now"),
    ]);
  });

  it("supports double-backtick spans containing a backtick", () => {
    expect(parseInline("`` a ` b ``")).toEqual([{ type: "code", value: "a ` b" }]);
  });

  it("leaves an unmatched backtick literal", () => {
    expect(parseInline("it`s fine")).toEqual([t("it`s fine")]);
  });

  it("parses bold and italic, including nesting", () => {
    expect(parseInline("**Request body:** x")).toEqual([
      { type: "strong", children: [t("Request body:")] },
      t(" x"),
    ]);
    expect(parseInline("an *italic* and _another_")).toEqual([
      t("an "),
      { type: "em", children: [t("italic")] },
      t(" and "),
      { type: "em", children: [t("another")] },
    ]);
    expect(parseInline("**bold with `code` and *em* inside**")).toEqual([
      {
        type: "strong",
        children: [
          t("bold with "),
          { type: "code", value: "code" },
          t(" and "),
          { type: "em", children: [t("em")] },
          t(" inside"),
        ],
      },
    ]);
  });

  it("does not treat snake_case or lone asterisks as emphasis", () => {
    expect(parseInline("set OPENEYE_API_KEY and my_var_name")).toEqual([
      t("set OPENEYE_API_KEY and my_var_name"),
    ]);
    expect(parseInline("2 * 3 * 4")).toEqual([t("2 * 3 * 4")]);
  });

  it("parses links with inline content", () => {
    expect(parseInline("see [the **docs**](/docs/quickstart).")).toEqual([
      t("see "),
      { type: "link", href: "/docs/quickstart", children: [t("the "), { type: "strong", children: [t("docs")] }] },
      t("."),
    ]);
    expect(parseInline('[keys](https://openrouter.ai/keys "title")')).toEqual([
      { type: "link", href: "https://openrouter.ai/keys", children: [t("keys")] },
    ]);
  });

  it("drops unsafe link targets but keeps the label", () => {
    expect(parseInline("[click](javascript:alert(1)) me")).toEqual([t("click me")]);
  });

  it("leaves brackets that aren't links alone", () => {
    expect(parseInline("array[0] and [x] (y)")).toEqual([t("array[0] and [x] (y)")]);
  });

  it("honours backslash escapes", () => {
    expect(parseInline("\\*not em\\* and \\`tick\\`")).toEqual([t("*not em* and `tick`")]);
  });

  it("never produces HTML: angle brackets stay text", () => {
    expect(parseInline("<script>alert(1)</script>")).toEqual([t("<script>alert(1)</script>")]);
  });
});

describe("safeHref", () => {
  it("allows http(s), mailto and same-site paths", () => {
    expect(safeHref("https://x.dev")).toBe("https://x.dev");
    expect(safeHref("mailto:a@b.c")).toBe("mailto:a@b.c");
    expect(safeHref("/docs/cli-api")).toBe("/docs/cli-api");
    expect(safeHref("#section")).toBe("#section");
  });

  it("rejects script-y and protocol-relative URLs", () => {
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref("data:text/html,hi")).toBeNull();
    expect(safeHref("//evil.example")).toBeNull();
  });
});

describe("inlineToPlainText", () => {
  it("strips markup", () => {
    expect(inlineToPlainText("Use `openeye run` with **care**, see [docs](/docs/x).")).toBe(
      "Use openeye run with care, see docs.",
    );
  });
});

describe("splitTableRow", () => {
  it("splits on pipes outside code spans", () => {
    expect(splitTableRow("| `a | b` | c |")).toEqual(["`a | b`", "c"]);
  });

  it("keeps escaped pipes in the cell", () => {
    expect(splitTableRow("| a \\| b | c |")).toEqual(["a \\| b", "c"]);
  });
});
