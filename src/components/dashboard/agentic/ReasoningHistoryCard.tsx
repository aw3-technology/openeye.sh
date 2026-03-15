import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Brain } from "lucide-react";
import { formatTimeAgo } from "./constants";

interface ReasoningHistoryCardProps {
  history: Array<{ timestamp: number; description: string }>;
}

export function ReasoningHistoryCard({ history }: ReasoningHistoryCardProps) {
  if (history.length === 0) return null;

  return (
    <Card className="border-terminal-amber/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-mono flex items-center gap-2 text-terminal-amber">
          <Brain className="h-4 w-4" />
          REASONING HISTORY
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-40">
          <div className="space-y-2">
            {history.slice(0, 8).map((entry, i) => (
              <div
                key={`${entry.timestamp}-${i}`}
                className="text-xs text-muted-foreground border-l-2 border-terminal-amber/20 pl-2 py-1"
              >
                <span className="font-mono text-[10px] text-terminal-amber/60 block">
                  {formatTimeAgo(entry.timestamp)}
                </span>
                <span className="line-clamp-2">{entry.description}</span>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
