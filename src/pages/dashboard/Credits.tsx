import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  Coins,
  ChevronLeft,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  Receipt,
  Eye,
  Box,
  ScanSearch,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import {
  useCreditBalance,
  usePricingTiers,
  useCreditTransactions,
  useCreateCheckout,
} from "@/hooks/useCredits";
import { getTotalBalance } from "@/types/credits";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PricingTier } from "@/types/credits";

function PricingTierCard({
  tier,
  onBuy,
  loading,
}: {
  tier: PricingTier;
  onBuy: () => void;
  loading: boolean;
}) {
  return (
    <Card className={tier.is_popular ? "border-primary" : ""}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          {tier.name}
          {tier.is_popular && (
            <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
              Popular
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <span className="text-2xl font-bold">${parseFloat(tier.price).toFixed(2)}</span>
        </div>
        <p className="text-sm text-muted-foreground">
          {tier.credits.toLocaleString()} credits
        </p>
        <Button className="w-full" onClick={onBuy} disabled={loading}>
          {loading ? "Redirecting..." : "Buy"}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function Credits() {
  const [searchParams, setSearchParams] = useSearchParams();
  const qc = useQueryClient();
  const balance = useCreditBalance();
  const tiers = usePricingTiers();
  const checkout = useCreateCheckout();
  const [txPage, setTxPage] = useState(0);
  const transactions = useCreditTransactions(txPage);

  useEffect(() => {
    if (searchParams.get("purchase") === "success") {
      // Always refetch the actual balance from the server — the URL param
      // only triggers a refresh, it doesn't grant credits.
      qc.invalidateQueries({ queryKey: ["credits"] });
      toast.success("Purchase completed — refreshing balance.");
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, qc]);

  const handleBuy = (tier: PricingTier) => {
    const successUrl = `${window.location.origin}/dashboard/credits?purchase=success`;
    const cancelUrl = `${window.location.origin}/dashboard/credits`;
    checkout.mutate(
      { tierId: tier.id, successUrl, cancelUrl },
      {
        onSuccess: (data) => {
          window.location.href = data.url;
        },
      },
    );
  };

  const pageSize = 20;
  const totalTx = transactions.data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalTx / pageSize));

  const txStats = useMemo(() => {
    const txs = transactions.data?.data ?? [];
    let totalSpent = 0;
    let totalAdded = 0;
    let txCount = txs.length;
    for (const tx of txs) {
      if (tx.amount < 0) totalSpent += Math.abs(tx.amount);
      else totalAdded += tx.amount;
    }
    return { totalSpent, totalAdded, txCount };
  }, [transactions.data]);

  const currentBalance = balance.data?.balance ?? 0;

  const creditCosts = [
    { endpoint: "POST /v1/detect", model: "YOLOv8", credits: 1, icon: Eye },
    { endpoint: "POST /v1/depth", model: "Depth Anything V2", credits: 2, icon: Box },
    { endpoint: "POST /v1/describe", model: "VLM (Qwen2.5-VL)", credits: 3, icon: ScanSearch },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Credits & Billing</h1>

      {/* Balance + stats row */}
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
                {transactions.isLoading ? "—" : txStats.totalSpent.toLocaleString()}
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
                {transactions.isLoading ? "—" : txStats.totalAdded.toLocaleString()}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pricing tiers */}
      <div>
        <h2 className="mb-3 text-lg font-medium">Buy Credits</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tiers.data?.map((tier) => (
            <PricingTierCard
              key={tier.id}
              tier={tier}
              onBuy={() => handleBuy(tier)}
              loading={checkout.isPending}
            />
          ))}
          {tiers.isLoading && (
            <p className="col-span-full text-sm text-muted-foreground">Loading tiers...</p>
          )}
          {tiers.isError && (
            <p className="col-span-full text-sm text-destructive" role="alert">
              Failed to load pricing tiers. Please refresh the page.
            </p>
          )}
        </div>
      </div>

      {/* Credit costs reference */}
      <div>
        <h2 className="mb-3 text-lg font-medium">Credit Costs per API Call</h2>
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Endpoint</TableHead>
                <TableHead>Model</TableHead>
                <TableHead className="text-right">Credits</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {creditCosts.map((cost) => (
                <TableRow key={cost.endpoint}>
                  <TableCell className="text-xs font-mono">{cost.endpoint}</TableCell>
                  <TableCell className="text-xs">{cost.model}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant="secondary" className="tabular-nums">
                      {cost.credits}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex items-start gap-2 border-t px-4 py-3">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              Self-hosted inference via{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-[11px]">openeye serve</code>{" "}
              is always free and uses no credits.
            </p>
          </div>
        </Card>
      </div>

      {/* Transaction history */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-medium">Transaction History</h2>
          {totalTx > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Receipt className="h-3.5 w-3.5" />
              {totalTx.toLocaleString()} total
            </div>
          )}
        </div>
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.data?.data.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell className="text-xs tabular-nums">
                    {new Date(tx.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-xs">
                    <Badge
                      variant={
                        tx.type === "purchase"
                          ? "default"
                          : tx.type === "refund"
                            ? "secondary"
                            : tx.type === "bonus"
                              ? "secondary"
                              : "outline"
                      }
                      className="text-[10px]"
                    >
                      {tx.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">{tx.description}</TableCell>
                  <TableCell
                    className={`text-right text-xs tabular-nums font-medium ${
                      tx.amount > 0 ? "text-green-600" : "text-red-500"
                    }`}
                  >
                    {tx.amount > 0 ? "+" : ""}
                    {tx.amount}
                  </TableCell>
                </TableRow>
              ))}
              {transactions.isLoading && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              )}
              {transactions.isError && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm text-destructive">
                    Failed to load transactions.
                  </TableCell>
                </TableRow>
              )}
              {!transactions.isLoading &&
                !transactions.isError &&
                (transactions.data?.data.length ?? 0) === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                      No transactions yet.
                    </TableCell>
                  </TableRow>
                )}
            </TableBody>
          </Table>
          {totalPages > 1 && (
            <div className="flex items-center justify-end gap-2 border-t px-4 py-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={txPage === 0}
                onClick={() => setTxPage((p) => p - 1)}
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span
                className="text-xs text-muted-foreground"
                aria-label={`Page ${txPage + 1} of ${totalPages}`}
              >
                {txPage + 1} / {totalPages}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={txPage >= totalPages - 1}
                onClick={() => setTxPage((p) => p + 1)}
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
