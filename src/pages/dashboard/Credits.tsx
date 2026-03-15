import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Coins, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import {
  useCreditBalance,
  usePricingTiers,
  useCreditTransactions,
  useCreateCheckout,
} from "@/hooks/useCredits";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
    <Card className={tier.popular ? "border-primary" : ""}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          {tier.name}
          {tier.popular && (
            <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
              Popular
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <span className="text-2xl font-bold">${(tier.price_cents / 100).toFixed(2)}</span>
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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Credits & Billing</h1>

      {/* Balance card */}
      <Card>
        <CardContent className="flex items-center gap-4 py-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-yellow-500/10">
            <Coins className="h-6 w-6 text-yellow-500" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Current Balance</p>
            <p className="text-3xl font-bold tabular-nums">
              {balance.isLoading ? "—" : balance.isError ? "Error" : (balance.data?.balance ?? 0).toLocaleString()}
            </p>
            {balance.isError && (
              <p className="text-xs text-destructive" role="alert">Could not load balance.</p>
            )}
          </div>
        </CardContent>
      </Card>

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

      {/* Transaction history */}
      <div>
        <h2 className="mb-3 text-lg font-medium">Transaction History</h2>
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
                  <TableCell className="capitalize text-xs">{tx.type}</TableCell>
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
              {!transactions.isLoading && !transactions.isError && (transactions.data?.data.length ?? 0) === 0 && (
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
              <span className="text-xs text-muted-foreground" aria-label={`Page ${txPage + 1} of ${totalPages}`}>
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
