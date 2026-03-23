import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { InferenceHistoryRow } from "@/types/openeye";
import { format } from "date-fns";

interface ExportResultSelectorProps {
  rows: InferenceHistoryRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function ExportResultSelector({ rows, selectedId, onSelect }: ExportResultSelectorProps) {
  return (
    <Card className="lg:col-span-1">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Select Result</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1 max-h-[420px] overflow-auto">
          {rows.map((row) => (
            <button
              key={row.id}
              onClick={() => onSelect(row.id)}
              className={`w-full text-left px-3 py-2 rounded-md text-xs transition-colors ${
                selectedId === row.id
                  ? "bg-primary/10 text-primary ring-1 ring-primary/20"
                  : "hover:bg-muted"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium truncate">{row.model}</span>
                <Badge variant="outline" className="ml-2 text-[10px] shrink-0">
                  {row.object_count} obj
                </Badge>
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5 font-mono tabular-nums">
                {format(new Date(row.created_at), "yyyy-MM-dd HH:mm:ss")} — {row.inference_ms.toFixed(0)}ms
              </div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
