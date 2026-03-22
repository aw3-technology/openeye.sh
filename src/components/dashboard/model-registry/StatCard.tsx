import { Card, CardContent } from "@/components/ui/card";

export function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          {icon}
          <span className="text-xs">{label}</span>
        </div>
        <p className={`text-lg font-semibold tabular-nums font-mono ${color}`}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
