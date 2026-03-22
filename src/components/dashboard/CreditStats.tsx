import { Coins, TrendingDown, TrendingUp } from "lucide-react";
import type { useCreditBalance } from "@/hooks/useCredits";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface CreditStatsProps {
  balance: ReturnType<typeof useCreditBalance>;
  currentBalance: number;
  txStats: { totalSpent: number; totalAdded: number; txCount: number };
  transactionsLoading: boolean;
}

export function CreditStats({
  balance,
  currentBalance,
  txStats,
  transactionsLoading,
}: CreditStatsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card className="sm:col-span-2">
        <CardContent className="flex items-center gap-4 py-6">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-yellow-500/10">
            <Coins className="h-6 w-6 text-yellow-500" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted-foreground">Current Balance</p>
            <p className="text-3xl font-bold tabular-nums">
              {balance.isLoading
                ? "—"
                : balance.isError
                  ? "Error"
                  : currentBalance.toLocaleString()}
            </p>
            {balance.isError && (
              <p className="text-xs text-destructive" role="alert">
                Could not load balance.
              </p>
            )}
            {!balance.isLoading && !balance.isError && (
              <div className="mt-2 space-y-1">
                <Progress
                  value={Math.min(100, (currentBalance / Math.max(currentBalance, 1000)) * 100)}
                  className="h-2"
                />
                <p className="text-[10px] text-muted-foreground">
                  {currentBalance < 10
                    ? "Low balance — consider buying more credits"
                    : currentBalance < 100
                      ? "Moderate balance"
                      : "Healthy balance"}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-start gap-3 p-4">
          <div className="rounded-md bg-red-500/10 p-2">
            <TrendingDown className="h-4 w-4 text-red-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Spent (this page)</p>
            <p className="text-xl font-semibold tabular-nums">
              {transactionsLoading ? "—" : txStats.totalSpent.toLocaleString()}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-start gap-3 p-4">
          <div className="rounded-md bg-green-500/10 p-2">
            <TrendingUp className="h-4 w-4 text-green-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Added (this page)</p>
            <p className="text-xl font-semibold tabular-nums">
              {transactionsLoading ? "—" : txStats.totalAdded.toLocaleString()}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
