import { describe, it, expect, beforeAll } from "vitest";
import { installTranslateDomGuard } from "@/lib/translate-dom-guard";

describe("installTranslateDomGuard", () => {
  beforeAll(() => installTranslateDomGuard());

  it("ignores removeChild of a node a translator moved elsewhere", () => {
    const parent = document.createElement("div");
    const text = document.createTextNode("hello");
    parent.appendChild(text);
    const font = document.createElement("font");
    font.appendChild(text); // what Google Translate does
    parent.appendChild(font);
    expect(() => parent.removeChild(text)).not.toThrow();
    expect(font.firstChild).toBe(text);
  });

  it("appends when insertBefore's reference node has moved", () => {
    const parent = document.createElement("div");
    const ref = document.createTextNode("ref");
    document.createElement("font").appendChild(ref);
    const node = document.createElement("span");
    expect(() => parent.insertBefore(node, ref)).not.toThrow();
    expect(parent.lastChild).toBe(node);
  });

  it("keeps normal removeChild/insertBefore behaviour", () => {
    const parent = document.createElement("div");
    const a = parent.appendChild(document.createElement("a"));
    const b = document.createElement("b");
    parent.insertBefore(b, a);
    expect(parent.firstChild).toBe(b);
    parent.removeChild(a);
    expect(parent.childNodes.length).toBe(1);
  });

  it("is idempotent", () => {
    const before = Node.prototype.removeChild;
    installTranslateDomGuard();
    expect(Node.prototype.removeChild).toBe(before);
  });
});
