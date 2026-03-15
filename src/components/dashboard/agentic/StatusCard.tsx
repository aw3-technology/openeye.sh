import { Card, CardContent } from "@/components/ui/card";
import { COLOR_STYLES } from "./constants";

interface StatusCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}

export function StatusCard({ icon, label, value, color }: StatusCardProps) {
  const styles = COLOR_STYLES[color] ?? COLOR_STYLES["terminal-green"];
  return (
    <Card className={styles.border}>
      <CardContent className="pt-3 pb-2 px-3">
        <div className="flex items-center gap-2">
          <div className={styles.text}>{icon}</div>
          <div>
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
              {label}
            </p>
            <p className={`text-lg font-semibold font-mono tabular-nums ${styles.text}`}>
              {value}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
