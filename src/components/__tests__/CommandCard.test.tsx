import { render, screen } from "@testing-library/react";
import { CommandCard } from "../CommandCard";

// framer-motion works in jsdom with IntersectionObserver mock from setup.ts

describe("CommandCard", () => {
  it("renders label, command, and description", () => {
    render(
      <CommandCard
        label="Detect"
        command="openeye detect image.jpg"
        description="Run object detection on any image."
      />
    );

    expect(screen.getByText("Detect")).toBeInTheDocument();
    expect(screen.getByText("$ openeye detect image.jpg")).toBeInTheDocument();
    expect(
      screen.getByText("Run object detection on any image.")
    ).toBeInTheDocument();
  });

  it("renders different props correctly", () => {
    render(
      <CommandCard
        label="Serve"
        command="openeye serve yolov8"
        description="Start the inference server."
      />
    );

    expect(screen.getByText("Serve")).toBeInTheDocument();
    expect(screen.getByText("$ openeye serve yolov8")).toBeInTheDocument();
  });

  // ── Edge cases ─────────────────────────────────────────────────

  it("renders empty strings without crashing", () => {
    render(<CommandCard label="" command="" description="" />);
    // The "$ " prefix is always rendered
    expect(screen.getByText("$")).toBeInTheDocument();
  });

  it("renders long text without crashing", () => {
    const longLabel = "a".repeat(200);
    const longCmd = "b".repeat(200);
    const longDesc = "c".repeat(200);
    render(
      <CommandCard
        label={longLabel}
        command={longCmd}
        description={longDesc}
      />
    );
    expect(screen.getByText(longLabel)).toBeInTheDocument();
    expect(screen.getByText(longDesc)).toBeInTheDocument();
  });

  it("renders special characters in props", () => {
    render(
      <CommandCard
        label="Test/Label"
        command="openeye --flag=value"
        description="Handles special flags & values"
      />
    );
    expect(screen.getByText("Test/Label")).toBeInTheDocument();
    expect(screen.getByText("$ openeye --flag=value")).toBeInTheDocument();
  });
});
