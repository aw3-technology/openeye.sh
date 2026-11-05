import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { DocsContent } from "@/components/docs/DocsContent";
import { parseMarkdown } from "@/data/docs-markdown";

function renderMd(md: string) {
  return render(
    <MemoryRouter>
      <DocsContent section={{ id: "t", title: "Test", blocks: parseMarkdown(md) }} />
    </MemoryRouter>,
  );
}

describe("DocsContent inline markdown", () => {
  it("renders inline code, bold, italic and links as elements", () => {
    const { container } = renderMd(
      "Run `openeye pull` with **care** and *style*. See [Quickstart](/docs/quickstart) or [OpenRouter](https://openrouter.ai/keys).",
    );
    expect(container.querySelector("p code")?.textContent).toBe("openeye pull");
    expect(container.querySelector("p strong")?.textContent).toBe("care");
    expect(container.querySelector("p em")?.textContent).toBe("style");
    expect(container.textContent).not.toMatch(/[`*]/);

    const internal = screen.getByRole("link", { name: "Quickstart" });
    expect(internal.getAttribute("href")).toBe("/docs/quickstart");
    expect(internal.hasAttribute("target")).toBe(false);

    const external = screen.getByRole("link", { name: "OpenRouter" });
    expect(external.getAttribute("href")).toBe("https://openrouter.ai/keys");
    expect(external.getAttribute("target")).toBe("_blank");
    expect(external.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("renders ordered lists as <ol> with the right start", () => {
    const { container } = renderMd("1. one\n2. `two`\n\n```\nx\n```\n\n3. three");
    const lists = container.querySelectorAll("ol");
    expect(lists).toHaveLength(2);
    expect(lists[0].querySelectorAll("li")).toHaveLength(2);
    expect(lists[0].querySelector("code")?.textContent).toBe("two");
    expect(lists[0].hasAttribute("start")).toBe(false);
    expect(lists[1].getAttribute("start")).toBe("3");
  });

  it("formats table cells, callouts and headings", () => {
    const { container } = renderMd(
      "## The `serve` command\n\n| Flag | Default |\n|---|---|\n| `--port` | **8000** |\n\n> [!warning] Use `--host 0.0.0.0` with care",
    );
    expect(container.querySelector("h2 code")?.textContent).toBe("serve");
    expect(container.querySelector("td code")?.textContent).toBe("--port");
    expect(container.querySelector("td strong")?.textContent).toBe("8000");
    expect(container.querySelector(".border-l-2 code")?.textContent).toBe("--host 0.0.0.0");
  });

  it("does not render raw HTML from markdown", () => {
    const { container } = renderMd('Hi <img src=x onerror="alert(1)"> [x](javascript:alert(1))');
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("a")).toBeNull();
  });
});
