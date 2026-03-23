import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SafetyLog } from "../dashboard/SafetyLog";

// Mock framer-motion to avoid animation issues in tests
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe("SafetyLog", () => {
  beforeEach(() => {
    vi.spyOn(Math, "random").mockReturnValue(0.5); // Prevent random "scene clear" entries
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows idle message when not streaming", () => {
    render(<SafetyLog isStreaming={false} objects={[]} />);
    expect(screen.getByText("Start camera to enable safety monitoring.")).toBeInTheDocument();
  });

  it("shows monitoring message when streaming with no objects", () => {
    render(<SafetyLog isStreaming={true} objects={[]} />);
    expect(screen.getByText("Monitoring...")).toBeInTheDocument();
  });

  it("shows DANGER alert for person with large bbox", () => {
    const objects = [
      { label: "person", confidence: 0.9, bbox: { h: 0.7 } },
    ];
    render(<SafetyLog isStreaming={true} objects={objects} />);
    expect(screen.getByText(/DANGER zone/)).toBeInTheDocument();
  });

  it("shows CAUTION alert for person with medium bbox", () => {
    const objects = [
      { label: "person", confidence: 0.9, bbox: { h: 0.4 } },
    ];
    render(<SafetyLog isStreaming={true} objects={objects} />);
    expect(screen.getByText(/CAUTION zone/)).toBeInTheDocument();
  });

  it("shows hazard alert for knife detection", () => {
    const objects = [
      { label: "knife", confidence: 0.8, bbox: { h: 0.1 } },
    ];
    render(<SafetyLog isStreaming={true} objects={objects} />);
    expect(screen.getByText(/Hazard detected: knife/)).toBeInTheDocument();
  });

  it("shows hazard alert for low confidence detection", () => {
    const objects = [
      { label: "unknown", confidence: 0.3, bbox: { h: 0.1 } },
    ];
    render(<SafetyLog isStreaming={true} objects={objects} />);
    expect(screen.getByText(/Hazard detected: unknown/)).toBeInTheDocument();
  });

  it("renders Safety Log title", () => {
    render(<SafetyLog isStreaming={false} objects={[]} />);
    expect(screen.getByText("Safety Log")).toBeInTheDocument();
  });

  it("shows log count badge when entries exist", () => {
    const objects = [
      { label: "person", confidence: 0.9, bbox: { h: 0.7 } },
    ];
    render(<SafetyLog isStreaming={true} objects={objects} />);
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("clears logs when streaming stops", () => {
    const objects = [
      { label: "person", confidence: 0.9, bbox: { h: 0.7 } },
    ];
    const { rerender } = render(<SafetyLog isStreaming={true} objects={objects} />);
    expect(screen.getByText(/DANGER zone/)).toBeInTheDocument();

    rerender(<SafetyLog isStreaming={false} objects={[]} />);
    expect(screen.queryByText(/DANGER zone/)).not.toBeInTheDocument();
  });

  it("does not generate entry for safe person (bbox <= 0.3)", () => {
    const objects = [
      { label: "person", confidence: 0.9, bbox: { h: 0.2 } },
    ];
    render(<SafetyLog isStreaming={true} objects={objects} />);
    expect(screen.queryByText(/DANGER/)).not.toBeInTheDocument();
    expect(screen.queryByText(/CAUTION zone/)).not.toBeInTheDocument();
  });

  it("handles multiple persons with mixed safety levels", () => {
    const objects = [
      { label: "person", confidence: 0.9, bbox: { h: 0.7 } },
      { label: "person", confidence: 0.9, bbox: { h: 0.4 } },
      { label: "person", confidence: 0.9, bbox: { h: 0.1 } },
    ];
    render(<SafetyLog isStreaming={true} objects={objects} />);
    expect(screen.getByText(/DANGER zone/)).toBeInTheDocument();
    expect(screen.getByText(/CAUTION zone/)).toBeInTheDocument();
  });
});
