import { Card, CardContent } from "@/components/ui/card";

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}

export function StatCard({ icon, label, value, highlight }: StatCardProps) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
          {icon}
          <span className="text-xs">{label}</span>
        </div>
        <p
          className={`text-sm font-semibold tabular-nums font-mono ${
            highlight ? "text-terminal-green" : ""
          }`}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
