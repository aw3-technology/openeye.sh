import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { KeysTable, type KeysTableProps } from "../dashboard/KeysTable";

const mockKeys: KeysTableProps["keys"] = [
  {
    id: "key-1",
    name: "Production Key",
    key_prefix: "oe_prod",
    created_at: "2025-01-15T10:00:00Z",
    last_used_at: "2025-03-20T08:30:00Z",
  },
  {
    id: "key-2",
    name: "Test Key",
    key_prefix: "oe_test",
    created_at: "2025-02-01T14:00:00Z",
    last_used_at: null,
  },
];

describe("KeysTable", () => {
  it("renders loading state", () => {
    render(<KeysTable keys={[]} isLoading={true} onDelete={vi.fn()} />);
    // LoadingState component should be rendered (not the table)
    expect(screen.queryByText("Your Keys")).toBeInTheDocument();
    expect(screen.queryByText("No API keys yet")).not.toBeInTheDocument();
  });

  it("renders empty state when no keys", () => {
    render(<KeysTable keys={[]} isLoading={false} onDelete={vi.fn()} />);
    expect(screen.getByText("No API keys yet")).toBeInTheDocument();
    expect(
      screen.getByText(/Create your first key/),
    ).toBeInTheDocument();
  });

  it("renders keys in a table", () => {
    render(<KeysTable keys={mockKeys} isLoading={false} onDelete={vi.fn()} />);
    expect(screen.getByText("Production Key")).toBeInTheDocument();
    expect(screen.getByText("Test Key")).toBeInTheDocument();
    expect(screen.getByText("oe_prod...")).toBeInTheDocument();
    expect(screen.getByText("oe_test...")).toBeInTheDocument();
  });

  it("shows 'Never' for keys that have not been used", () => {
    render(<KeysTable keys={mockKeys} isLoading={false} onDelete={vi.fn()} />);
    expect(screen.getByText("Never")).toBeInTheDocument();
  });

  it("displays key count badge", () => {
    render(<KeysTable keys={mockKeys} isLoading={false} onDelete={vi.fn()} />);
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("does not display badge when no keys", () => {
    render(<KeysTable keys={[]} isLoading={false} onDelete={vi.fn()} />);
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("renders delete buttons for each key", () => {
    render(<KeysTable keys={mockKeys} isLoading={false} onDelete={vi.fn()} />);
    const deleteButtons = screen.getAllByRole("button", { name: /Delete key/i });
    expect(deleteButtons).toHaveLength(2);
  });

  it("renders table headers", () => {
    render(<KeysTable keys={mockKeys} isLoading={false} onDelete={vi.fn()} />);
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Prefix")).toBeInTheDocument();
    expect(screen.getByText("Created")).toBeInTheDocument();
    expect(screen.getByText("Last Used")).toBeInTheDocument();
  });

  it("formats creation date correctly", () => {
    render(<KeysTable keys={mockKeys} isLoading={false} onDelete={vi.fn()} />);
    expect(screen.getByText("2025-01-15")).toBeInTheDocument();
  });
});
