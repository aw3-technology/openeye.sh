import { Card, CardContent } from "@/components/ui/card";
import { Cpu, Eye, Gauge, Hash } from "lucide-react";

export interface HistoryStats {
  totalInferences: number;
  totalObjects: number;
  avgLatency: number;
  topLabel: string;
  uniqueModels: number;
}

export function HistoryStatsCards({ stats }: { stats: HistoryStats }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        icon={<Hash className="h-4 w-4 text-blue-500" />}
        iconBg="bg-blue-500/10"
        label="Total Inferences"
        value={stats.totalInferences.toLocaleString()}
      />
      <StatCard
        icon={<Gauge className="h-4 w-4 text-green-500" />}
        iconBg="bg-green-500/10"
        label="Avg Latency"
        value={stats.avgLatency.toFixed(1)}
        suffix="ms"
      />
      <StatCard
        icon={<Eye className="h-4 w-4 text-purple-500" />}
        iconBg="bg-purple-500/10"
        label="Objects Detected"
        value={stats.totalObjects.toLocaleString()}
        sub={`Top: ${stats.topLabel}`}
      />
      <StatCard
        icon={<Cpu className="h-4 w-4 text-amber-500" />}
        iconBg="bg-amber-500/10"
        label="Models Used"
        value={String(stats.uniqueModels)}
      />
    </div>
  );
}

function StatCard({
  icon,
  iconBg,
  label,
  value,
  suffix,
  sub,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: string;
  suffix?: string;
  sub?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-4">
        <div className={`rounded-md p-2 ${iconBg}`}>{icon}</div>
        <div className="space-y-0.5">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-semibold tabular-nums">
            {value}
            {suffix && (
              <span className="text-sm font-normal text-muted-foreground ml-0.5">
                {suffix}
              </span>
            )}
          </p>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
