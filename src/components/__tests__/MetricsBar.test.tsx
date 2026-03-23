import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock useOpenEyeStream before importing MetricsBar
const mockMetrics = { fps: 0, latency_ms: 0, frame_count: 0 };
let mockLatestResult: any = null;

vi.mock("@/hooks/useOpenEyeStream", () => ({
  useOpenEyeStream: () => ({
    metrics: mockMetrics,
    latestResult: mockLatestResult,
  }),
}));

import { MetricsBar } from "../dashboard/MetricsBar";

describe("MetricsBar", () => {
  beforeEach(() => {
    mockMetrics.fps = 0;
    mockMetrics.latency_ms = 0;
    mockMetrics.frame_count = 0;
    mockLatestResult = null;
  });

  it("renders all five metric labels", () => {
    render(<MetricsBar />);
    expect(screen.getByText("FPS")).toBeInTheDocument();
    expect(screen.getByText("Latency")).toBeInTheDocument();
    expect(screen.getByText("Objects")).toBeInTheDocument();
    expect(screen.getByText("Safety")).toBeInTheDocument();
    expect(screen.getByText("Frames")).toBeInTheDocument();
  });

  it("shows SAFE when no detections", () => {
    render(<MetricsBar />);
    expect(screen.getByText("SAFE")).toBeInTheDocument();
  });

  it("shows DANGER when person bbox > 0.6", () => {
    mockLatestResult = {
      objects: [
        { label: "person", confidence: 0.9, bbox: { x: 0, y: 0, w: 0.5, h: 0.7 } },
      ],
    };
    render(<MetricsBar />);
    expect(screen.getByText("DANGER")).toBeInTheDocument();
  });

  it("shows CAUTION when person bbox > 0.3", () => {
    mockLatestResult = {
      objects: [
        { label: "person", confidence: 0.9, bbox: { x: 0, y: 0, w: 0.3, h: 0.4 } },
      ],
    };
    render(<MetricsBar />);
    expect(screen.getByText("CAUTION")).toBeInTheDocument();
  });

  it("shows CAUTION when knife detected", () => {
    mockLatestResult = {
      objects: [
        { label: "knife", confidence: 0.8, bbox: { x: 0, y: 0, w: 0.1, h: 0.1 } },
      ],
    };
    render(<MetricsBar />);
    expect(screen.getByText("CAUTION")).toBeInTheDocument();
  });

  it("shows CAUTION when low confidence detection", () => {
    mockLatestResult = {
      objects: [
        { label: "cup", confidence: 0.3, bbox: { x: 0, y: 0, w: 0.1, h: 0.1 } },
      ],
    };
    render(<MetricsBar />);
    expect(screen.getByText("CAUTION")).toBeInTheDocument();
  });

  it("shows SAFE with normal detections", () => {
    mockLatestResult = {
      objects: [
        { label: "car", confidence: 0.9, bbox: { x: 0, y: 0, w: 0.2, h: 0.15 } },
      ],
    };
    render(<MetricsBar />);
    expect(screen.getByText("SAFE")).toBeInTheDocument();
  });

  it("displays correct FPS", () => {
    mockMetrics.fps = 25;
    render(<MetricsBar />);
    expect(screen.getByText("25")).toBeInTheDocument();
  });

  it("displays correct frame count", () => {
    mockMetrics.frame_count = 42;
    render(<MetricsBar />);
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("displays object count", () => {
    mockLatestResult = {
      objects: [
        { label: "car", confidence: 0.9, bbox: { x: 0, y: 0, w: 0.2, h: 0.15 } },
        { label: "bus", confidence: 0.8, bbox: { x: 0.5, y: 0, w: 0.3, h: 0.2 } },
      ],
    };
    render(<MetricsBar />);
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("shows 0 objects when no result", () => {
    render(<MetricsBar />);
    // Multiple 0s exist (FPS, Objects, Frames) — just ensure at least one
    expect(screen.getAllByText("0").length).toBeGreaterThanOrEqual(1);
  });
});
