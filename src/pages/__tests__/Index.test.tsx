import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";

// Mock heavy child components to keep tests fast and focused
vi.mock("@/components/Navbar", () => ({
  Navbar: () => <nav data-testid="navbar">Navbar</nav>,
}));
vi.mock("@/components/VisionFrame", () => ({
  VisionFrame: () => <div data-testid="vision-frame">VisionFrame</div>,
}));
vi.mock("@/components/SceneGraph", () => ({
  SceneGraph: () => <div data-testid="scene-graph">SceneGraph</div>,
}));
vi.mock("@/components/ArchitectureDiagram", () => ({
  ArchitectureDiagram: () => <div data-testid="arch-diagram">ArchDiagram</div>,
}));
vi.mock("@/components/TechEcosystem", () => ({
  TechEcosystem: () => <div data-testid="tech-ecosystem">TechEcosystem</div>,
}));
vi.mock("@/components/SafetyDemo", () => ({
  SafetyDemo: () => <div data-testid="safety-demo">SafetyDemo</div>,
}));
vi.mock("@/components/InteractiveTerminal", () => ({
  InteractiveTerminal: () => <div data-testid="terminal">Terminal</div>,
}));
vi.mock("@/components/CodeExamples", () => ({
  CodeExamples: () => <div data-testid="code-examples">CodeExamples</div>,
}));
vi.mock("@/components/GetStarted", () => ({
  GetStarted: () => <div data-testid="get-started">GetStarted</div>,
}));
vi.mock("@/components/DemoVideo", () => ({
  DemoVideo: () => <div data-testid="demo-video">DemoVideo</div>,
}));
vi.mock("@/assets/openeye-logo-vertical.png", () => ({
  default: "logo-vertical.png",
}));

import Index from "../Index";

function renderIndex() {
  return render(
    <MemoryRouter>
      <Index />
    </MemoryRouter>
  );
}

describe("Index page", () => {
  it("renders the hero section", () => {
    renderIndex();
    expect(
      screen.getByText("Open-source eyes for the agent era.")
    ).toBeInTheDocument();
  });

  it("renders key sections", () => {
    renderIndex();

    expect(screen.getByTestId("navbar")).toBeInTheDocument();
    expect(screen.getByTestId("vision-frame")).toBeInTheDocument();
    expect(screen.getByTestId("safety-demo")).toBeInTheDocument();
    expect(screen.getByTestId("arch-diagram")).toBeInTheDocument();
    expect(screen.getByTestId("tech-ecosystem")).toBeInTheDocument();
    expect(screen.getByTestId("code-examples")).toBeInTheDocument();
    expect(screen.getByTestId("get-started")).toBeInTheDocument();
  });

  it("renders CLI commands section", () => {
    renderIndex();
    expect(screen.getByText("CLI Reference")).toBeInTheDocument();
    expect(screen.getByText("Detect")).toBeInTheDocument();
  });

  it("renders the CTA section", () => {
    renderIndex();
    expect(
      screen.getByText("The perception layer is open.")
    ).toBeInTheDocument();
  });
});
