import {
  Eye,
  AlertTriangle,
  Zap,
  BarChart3,
  Activity,
  Tag,
} from "lucide-react";

export interface MemoryStats {
  total: number;
  highSignificance: number;
  changes: number;
  avgSignificance: number;
  uniqueObjects: number;
  uniqueTags: number;
}

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <div className="border border-foreground/5 rounded-lg bg-card px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
        {icon}
        <span className="text-[9px] font-mono uppercase tracking-wider">
          {label}
        </span>
      </div>
      <div
        className={`text-lg font-mono font-semibold tabular-nums ${accent ?? "text-foreground"}`}
      >
        {value}
      </div>
    </div>
  );
}

export function MemoryStatsRow({ stats }: { stats: MemoryStats }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
      <StatCard
        icon={<Eye className="h-3.5 w-3.5" />}
        label="Observations"
        value={stats.total}
      />
      <StatCard
        icon={<AlertTriangle className="h-3.5 w-3.5" />}
        label="High Significance"
        value={stats.highSignificance}
        accent="text-terminal-red"
      />
      <StatCard
        icon={<Zap className="h-3.5 w-3.5" />}
        label="Scene Changes"
        value={stats.changes}
        accent="text-terminal-amber"
      />
      <StatCard
        icon={<BarChart3 className="h-3.5 w-3.5" />}
        label="Avg Significance"
        value={`${(stats.avgSignificance * 100).toFixed(0)}%`}
      />
      <StatCard
        icon={<Activity className="h-3.5 w-3.5" />}
        label="Unique Objects"
        value={stats.uniqueObjects}
      />
      <StatCard
        icon={<Tag className="h-3.5 w-3.5" />}
        label="Unique Tags"
        value={stats.uniqueTags}
      />
    </div>
  );
}
