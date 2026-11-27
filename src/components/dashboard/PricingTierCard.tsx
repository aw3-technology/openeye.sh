import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { PricingTier } from "@/types/credits";

export function PricingTierCard({
  tier,
  onBuy,
  loading,
  unit = "credits",
}: {
  tier: PricingTier;
  onBuy: () => void;
  loading: boolean;
  /** What the pack buys: OpenEye "credits", or "Electrum" (the AW3-wide credit). */
  unit?: "credits" | "Electrum";
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
          {tier.credits.toLocaleString()} {unit}
        </p>
        <Button className="w-full" onClick={onBuy} disabled={loading}>
          {loading ? "Redirecting..." : "Buy"}
        </Button>
      </CardContent>
    </Card>
  );
}
