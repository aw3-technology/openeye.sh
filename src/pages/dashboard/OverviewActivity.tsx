import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Cpu, ImagePlus } from "lucide-react";
import type { InferenceHistoryRow } from "@/types/openeye";

export function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface OverviewActivityProps {
  recentInferences: InferenceHistoryRow[];
}

export function OverviewActivity({ recentInferences }: OverviewActivityProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">Recent Activity</CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/dashboard/history" className="gap-1 text-xs">
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {recentInferences.length === 0 ? (
          <div className="py-6 text-center">
            <ImagePlus className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">
              No inference history yet.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Run your first prediction from the{" "}
              <Link to="/dashboard/inference" className="text-primary hover:underline">
                Inference
              </Link>{" "}
              page.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentInferences.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between rounded-md border p-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="rounded-md bg-muted p-1.5">
                    <Cpu className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{entry.model}</p>
                    <p className="text-xs text-muted-foreground">
                      {entry.object_count} object{entry.object_count !== 1 ? "s" : ""} detected
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <Badge variant="outline" className="text-xs tabular-nums">
                    {entry.inference_ms}ms
                  </Badge>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatTimeAgo(entry.created_at)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
