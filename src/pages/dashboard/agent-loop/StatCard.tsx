import { Card, CardContent } from "@/components/ui/card";

export function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: "green" | "amber" | "red" | "muted";
}) {
  const styles = {
    green: { border: "border-terminal-green/20", text: "text-terminal-green" },
    amber: { border: "border-terminal-amber/20", text: "text-terminal-amber" },
    red: { border: "border-terminal-red/20", text: "text-terminal-red" },
    muted: { border: "border-border", text: "text-muted-foreground" },
  }[color];

  return (
    <Card className={styles.border}>
      <CardContent className="pt-3 pb-2 px-3">
        <div className="flex items-center gap-2">
          <div className={styles.text}>{icon}</div>
          <div>
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">{label}</p>
            <p className={`text-lg font-semibold font-mono tabular-nums ${styles.text}`}>{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
