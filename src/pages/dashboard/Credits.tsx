import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
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
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PricingTier } from "@/types/credits";
import { PricingTierCard } from "@/components/dashboard/PricingTierCard";
import { CreditStats } from "@/components/dashboard/CreditStats";
import { TransactionHistory } from "@/components/dashboard/TransactionHistory";

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

  const currentBalance = getTotalBalance(balance.data);

  const creditCosts = [
    { endpoint: "POST /v1/detect", model: "YOLOv8", credits: 1, icon: Eye },
    { endpoint: "POST /v1/depth", model: "Depth Anything V2", credits: 2, icon: Box },
    { endpoint: "POST /v1/describe", model: "VLM (Qwen2.5-VL)", credits: 3, icon: ScanSearch },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Credits & Billing</h1>

      {/* Balance + stats row */}
      <CreditStats
        balance={balance}
        currentBalance={currentBalance}
        txStats={txStats}
        transactionsLoading={transactions.isLoading}
      />

      {/* Pricing tiers */}
      <div>
        <h2 className="mb-3 text-lg font-medium">Buy Credits</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tiers.data?.pricing_tiers?.map((tier) => (
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
      <TransactionHistory
        transactions={transactions}
        txPage={txPage}
        setTxPage={setTxPage}
      />
    </div>
  );
}
