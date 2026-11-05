import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "@/hooks/useTheme";
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
    <ThemeProvider>
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>
    </ThemeProvider>
  );
}

describe("Navbar", () => {
  it("shows Sign in button when no user", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      signOut: vi.fn(),
      isDemo: false,
      signInAsDemo: vi.fn(),
    });

    renderNavbar();

    expect(screen.getAllByText("Sign in").length).toBeGreaterThan(0);
  });

  it("shows Sign out button when user exists", () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: "123",
        email: "test@example.com",
        user_metadata: { full_name: "Test User" },
      } as unknown as ReturnType<typeof useAuth>["user"],
      loading: false,
      signOut: vi.fn(),
      isDemo: false,
      signInAsDemo: vi.fn(),
    });

    renderNavbar();

    expect(screen.getAllByText("Sign out").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Test User").length).toBeGreaterThan(0);
  });

  it("renders nav links", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      signOut: vi.fn(),
      isDemo: false,
      signInAsDemo: vi.fn(),
    });

    const { container } = renderNavbar();
    const html = container.innerHTML;

    // Top-level menus; Docs, Pricing and GitHub live inside their dropdowns.
    expect(html).toContain("Product");
    expect(html).toContain("Resources");
    expect(html).toContain("Developers");
  });

  // ── Edge cases ─────────────────────────────────────────────────

  it("renders while loading", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: true,
      signOut: vi.fn(),
      isDemo: false,
      signInAsDemo: vi.fn(),
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
      loading: false,
      signOut: vi.fn(),
      isDemo: false,
      signInAsDemo: vi.fn(),
    });

    renderNavbar();

    expect(screen.getAllByText("Sign out").length).toBeGreaterThan(0);
  });
});
