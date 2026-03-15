import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DashboardErrorBoundary } from "../DashboardErrorBoundary";

function ThrowingChild({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error("Test render error");
  return <div>Child content</div>;
}

describe("DashboardErrorBoundary", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("renders children when no error", () => {
    render(
      <DashboardErrorBoundary>
        <ThrowingChild shouldThrow={false} />
      </DashboardErrorBoundary>,
    );
    expect(screen.getByText("Child content")).toBeInTheDocument();
  });

  it("renders error UI when child throws", () => {
    render(
      <DashboardErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </DashboardErrorBoundary>,
    );
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("Test render error")).toBeInTheDocument();
  });

  it("resets error state when Try Again is clicked", () => {
    // Use a ref to control throwing behavior
    let shouldThrow = true;

    function ConditionalChild() {
      if (shouldThrow) throw new Error("Test render error");
      return <div>Child content</div>;
    }

    render(
      <DashboardErrorBoundary>
        <ConditionalChild />
      </DashboardErrorBoundary>,
    );
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();

    // Stop throwing before clicking Try Again
    shouldThrow = false;
    fireEvent.click(screen.getByText("Try Again"));

    expect(screen.getByText("Child content")).toBeInTheDocument();
  });

  it("shows Back to Dashboard button", () => {
    render(
      <DashboardErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </DashboardErrorBoundary>,
    );
    expect(screen.getByText("Back to Dashboard")).toBeInTheDocument();
  });
});
