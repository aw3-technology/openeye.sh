import { Badge } from "@/components/ui/badge";

export function TagFilterBadges({ filter }: { filter?: Record<string, string> }) {
  const entries = Object.entries(filter || {});
  if (entries.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {entries.slice(0, 3).map(([k, v]) => (
        <Badge key={k} variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
          {k}={v}
        </Badge>
      ))}
      {entries.length > 3 && (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
          +{entries.length - 3}
        </Badge>
      )}
    </div>
  );
}
