import { useId } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface DataPoint {
  resource_usage: Record<string, number>;
  created_at: string;
}

interface ResourceChartProps {
  data: DataPoint[];
  metric: "cpu_percent" | "memory_percent" | "gpu_percent" | "disk_percent" | "gpu_temp_celsius" | "cpu_temp_celsius";
  label: string;
  color?: string;
  unit?: string;
}

export function ResourceChart({ data, metric, label, color = "#14b8a6", unit = "%" }: ResourceChartProps) {
  const id = useId();
  const chartData = data.map((d) => ({
    time: new Date(d.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    value: d.resource_usage[metric] ?? 0,
  }));

  return (
    <div className="w-full">
      <p className="text-sm font-medium text-muted-foreground mb-2">{label}</p>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id={`grad-${id}-${metric}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="time" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
          <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" domain={[0, unit === "%" ? 100 : "auto"]} />
          <Tooltip
            contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
            labelStyle={{ color: "hsl(var(--foreground))" }}
            formatter={(value: number) => [`${value.toFixed(1)}${unit}`, label]}
          />
          <Area type="monotone" dataKey="value" stroke={color} fill={`url(#grad-${id}-${metric})`} strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
