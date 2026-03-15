import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";

// Mock heavy child components to keep tests fast and focused
vi.mock("@/components/Navbar", () => ({
  Navbar: () => <nav data-testid="navbar">Navbar</nav>,
}));
vi.mock("@/components/Footer", () => ({
  Footer: () => <footer data-testid="footer">Footer</footer>,
}));
vi.mock("@/components/TechEcosystem", () => ({
  TechEcosystem: () => <div data-testid="tech-ecosystem">TechEcosystem</div>,
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
vi.mock("@/components/HeroSection", () => ({
  HeroSection: () => <section data-testid="hero-section">Open-source eyes for the agent era.</section>,
}));
vi.mock("@/components/VisionDemoSection", () => ({
  VisionDemoSection: () => <div data-testid="vision-demo">VisionDemo</div>,
}));
vi.mock("@/components/SafetyGuardianSection", () => ({
  SafetyGuardianSection: () => <div data-testid="safety-guardian">SafetyGuardian</div>,
}));
vi.mock("@/components/PerceptionLoopSection", () => ({
  PerceptionLoopSection: () => <div data-testid="perception-loop">PerceptionLoop</div>,
}));
vi.mock("@/components/ArchitectureSection", () => ({
  ArchitectureSection: () => <div data-testid="arch-section">Architecture</div>,
}));
vi.mock("@/components/CLICommandsSection", () => ({
  CLICommandsSection: () => <div data-testid="cli-commands">CLI Commands</div>,
}));
vi.mock("@/components/ProductionDashboardSection", () => ({
  ProductionDashboardSection: () => <div data-testid="prod-dashboard">ProductionDashboard</div>,
}));
vi.mock("@/components/DeployAnywhereSection", () => ({
  DeployAnywhereSection: () => <div data-testid="deploy-anywhere">DeployAnywhere</div>,
}));
vi.mock("@/components/BuiltWithSection", () => ({
  BuiltWithSection: () => <div data-testid="built-with">BuiltWith</div>,
}));
vi.mock("@/components/FinalCTA", () => ({
  FinalCTA: () => <div data-testid="final-cta">The perception layer is open.</div>,
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
    expect(screen.getByTestId("hero-section")).toBeInTheDocument();
    expect(screen.getByTestId("vision-demo")).toBeInTheDocument();
    expect(screen.getByTestId("safety-guardian")).toBeInTheDocument();
    expect(screen.getByTestId("arch-section")).toBeInTheDocument();
    expect(screen.getByTestId("tech-ecosystem")).toBeInTheDocument();
    expect(screen.getByTestId("code-examples")).toBeInTheDocument();
    expect(screen.getByTestId("get-started")).toBeInTheDocument();
  });

  it("renders CLI commands section", () => {
    renderIndex();
    expect(screen.getByTestId("cli-commands")).toBeInTheDocument();
  });

  it("renders the CTA section", () => {
    renderIndex();
    expect(
      screen.getByText("The perception layer is open.")
    ).toBeInTheDocument();
  });
});
