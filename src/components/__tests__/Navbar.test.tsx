import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";

// Mock useAuth before importing Navbar
vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

// Mock the logo import
vi.mock("@/assets/openeye-logo-horizontal.png", () => ({
  default: "logo.png",
}));

import { Navbar } from "../Navbar";
import { useAuth } from "@/hooks/useAuth";

const mockUseAuth = vi.mocked(useAuth);

function renderNavbar() {
  return render(
    <MemoryRouter>
      <Navbar />
    </MemoryRouter>
  );
}

describe("Navbar", () => {
  it("shows Sign In button when no user", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      session: null,
      loading: false,
      signOut: vi.fn(),
      tokenError: null,
    });

    renderNavbar();

    expect(screen.getAllByText("Sign In").length).toBeGreaterThan(0);
  });

  it("shows Sign Out button when user exists", () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: "123",
        email: "test@example.com",
        user_metadata: { full_name: "Test User" },
      } as unknown as ReturnType<typeof useAuth>["user"],
      session: {} as unknown as ReturnType<typeof useAuth>["session"],
      loading: false,
      signOut: vi.fn(),
      tokenError: null,
    });

    renderNavbar();

    expect(screen.getAllByText("Sign Out").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Test User").length).toBeGreaterThan(0);
  });

  it("renders nav links", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      session: null,
      loading: false,
      signOut: vi.fn(),
      tokenError: null,
    });

    const { container } = renderNavbar();
    const html = container.innerHTML;

    expect(html).toContain("Docs");
    expect(html).toContain("Pricing");
    expect(html).toContain("Blog");
    expect(html).toContain("GitHub");
  });

  // ── Edge cases ─────────────────────────────────────────────────

  it("renders while loading", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      session: null,
      loading: true,
      signOut: vi.fn(),
      tokenError: null,
    });

    const { container } = renderNavbar();
    // Should still render the nav structure
    expect(container.querySelector("nav")).not.toBeNull();
  });

  it("renders user without full_name", () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: "456",
        email: "noname@example.com",
        user_metadata: {},
      } as unknown as ReturnType<typeof useAuth>["user"],
      session: {} as unknown as ReturnType<typeof useAuth>["session"],
      loading: false,
      signOut: vi.fn(),
    });

    renderNavbar();

    expect(screen.getAllByText("Sign Out").length).toBeGreaterThan(0);
  });
});
