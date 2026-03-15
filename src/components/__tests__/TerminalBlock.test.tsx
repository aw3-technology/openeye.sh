import { render, screen } from "@testing-library/react";
import { TerminalBlock } from "../TerminalBlock";

describe("TerminalBlock", () => {
  const lines = [
    { text: "$ openeye detect photo.jpg", color: "green" as const },
    { text: "Detected 3 objects", color: "default" as const },
  ];

  it("renders lines when animation is disabled", () => {
    render(<TerminalBlock lines={lines} animate={false} />);

    expect(
      screen.getByText("$ openeye detect photo.jpg")
    ).toBeInTheDocument();
    expect(screen.getByText("Detected 3 objects")).toBeInTheDocument();
  });

  it("renders title when provided", () => {
    render(<TerminalBlock lines={lines} title="terminal" animate={false} />);

    expect(screen.getByText("terminal")).toBeInTheDocument();
  });

  it("renders without title", () => {
    const { container } = render(
      <TerminalBlock lines={lines} animate={false} />
    );
    // Should still render the terminal chrome dots
    expect(container.querySelectorAll(".rounded-full").length).toBe(3);
  });

  // ── Edge cases ─────────────────────────────────────────────────

  it("renders empty lines array without crashing", () => {
    const { container } = render(
      <TerminalBlock lines={[]} animate={false} />
    );
    // Chrome dots should still render
    expect(container.querySelectorAll(".rounded-full").length).toBe(3);
  });

  it("renders single line", () => {
    render(
      <TerminalBlock
        lines={[{ text: "only line" }]}
        animate={false}
      />
    );
    expect(screen.getByText("only line")).toBeInTheDocument();
  });

  it("applies color classes correctly", () => {
    const colorLines = [
      { text: "green text", color: "green" as const },
      { text: "amber text", color: "amber" as const },
      { text: "red text", color: "red" as const },
      { text: "muted text", color: "muted" as const },
    ];
    render(<TerminalBlock lines={colorLines} animate={false} />);

    expect(screen.getByText("green text")).toBeInTheDocument();
    expect(screen.getByText("amber text")).toBeInTheDocument();
    expect(screen.getByText("red text")).toBeInTheDocument();
    expect(screen.getByText("muted text")).toBeInTheDocument();
  });

  it("uses default color when no color specified", () => {
    render(
      <TerminalBlock
        lines={[{ text: "no color" }]}
        animate={false}
      />
    );
    const el = screen.getByText("no color");
    expect(el.className).toContain("text-terminal-fg");
  });

  it("renders many lines", () => {
    const manyLines = Array.from({ length: 50 }, (_, i) => ({
      text: `line ${i}`,
    }));
    render(<TerminalBlock lines={manyLines} animate={false} />);
    expect(screen.getByText("line 0")).toBeInTheDocument();
    expect(screen.getByText("line 49")).toBeInTheDocument();
  });
});
