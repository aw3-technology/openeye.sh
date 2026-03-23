import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { CreditStats } from "../dashboard/CreditStats";

function makeBalance(overrides: Record<string, unknown> = {}) {
  return {
    data: { balance: 500 },
    isLoading: false,
    isError: false,
    ...overrides,
  } as any;
}

describe("CreditStats", () => {
  it("renders current balance", () => {
    render(
      <CreditStats
        balance={makeBalance()}
        currentBalance={500}
        txStats={{ totalSpent: 100, totalAdded: 600, txCount: 10 }}
        transactionsLoading={false}
      />,
    );
    expect(screen.getByText("500")).toBeInTheDocument();
    expect(screen.getByText("Current Balance")).toBeInTheDocument();
  });

  it("shows loading dash when balance is loading", () => {
    render(
      <CreditStats
        balance={makeBalance({ isLoading: true })}
        currentBalance={0}
        txStats={{ totalSpent: 0, totalAdded: 0, txCount: 0 }}
        transactionsLoading={false}
      />,
    );
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("shows error state when balance fails", () => {
    render(
      <CreditStats
        balance={makeBalance({ isError: true })}
        currentBalance={0}
        txStats={{ totalSpent: 0, totalAdded: 0, txCount: 0 }}
        transactionsLoading={false}
      />,
    );
    expect(screen.getByText("Error")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("shows spent and added stats", () => {
    render(
      <CreditStats
        balance={makeBalance()}
        currentBalance={500}
        txStats={{ totalSpent: 150, totalAdded: 650, txCount: 20 }}
        transactionsLoading={false}
      />,
    );
    expect(screen.getByText("150")).toBeInTheDocument();
    expect(screen.getByText("650")).toBeInTheDocument();
  });

  it("shows dashes when transactions are loading", () => {
    render(
      <CreditStats
        balance={makeBalance()}
        currentBalance={500}
        txStats={{ totalSpent: 0, totalAdded: 0, txCount: 0 }}
        transactionsLoading={true}
      />,
    );
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });

  it("shows low balance message when balance < 10", () => {
    render(
      <CreditStats
        balance={makeBalance()}
        currentBalance={5}
        txStats={{ totalSpent: 0, totalAdded: 0, txCount: 0 }}
        transactionsLoading={false}
      />,
    );
    expect(screen.getByText(/Low balance/)).toBeInTheDocument();
  });

  it("shows moderate balance message when 10 <= balance < 100", () => {
    render(
      <CreditStats
        balance={makeBalance()}
        currentBalance={50}
        txStats={{ totalSpent: 0, totalAdded: 0, txCount: 0 }}
        transactionsLoading={false}
      />,
    );
    expect(screen.getByText("Moderate balance")).toBeInTheDocument();
  });

  it("shows healthy balance message when balance >= 100", () => {
    render(
      <CreditStats
        balance={makeBalance()}
        currentBalance={500}
        txStats={{ totalSpent: 0, totalAdded: 0, txCount: 0 }}
        transactionsLoading={false}
      />,
    );
    expect(screen.getByText("Healthy balance")).toBeInTheDocument();
  });

  it("renders spent and added labels", () => {
    render(
      <CreditStats
        balance={makeBalance()}
        currentBalance={500}
        txStats={{ totalSpent: 100, totalAdded: 600, txCount: 10 }}
        transactionsLoading={false}
      />,
    );
    expect(screen.getByText("Spent (this page)")).toBeInTheDocument();
    expect(screen.getByText("Added (this page)")).toBeInTheDocument();
  });
});
