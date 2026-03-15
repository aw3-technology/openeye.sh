import { Link } from "react-router-dom";
import { Coins, AlertCircle } from "lucide-react";
import { useCreditBalance } from "@/hooks/useCredits";
import { getTotalBalance } from "@/types/credits";

export function CreditBalanceBadge() {
  const { data, isLoading, isError } = useCreditBalance();
  const balance = getTotalBalance(data);

  return (
    <Link
      to="/dashboard/credits"
      className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-colors hover:bg-muted"
    >
      {isError ? (
        <AlertCircle className="h-4 w-4 text-destructive" />
      ) : (
        <Coins className="h-4 w-4 text-yellow-500" />
      )}
      <span className="tabular-nums">
        {isLoading ? "—" : isError ? "!" : balance}
      </span>
    </Link>
  );
}
