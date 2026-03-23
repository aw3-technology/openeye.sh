import { useState, useMemo } from "react";
import { useInferenceHistory } from "@/hooks/useOpenEyeQueries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GitBranch, Eye } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import type { DetectedObject } from "@/types/openeye";

import {
  TreeNodeView,
  buildBasicTree,
} from "@/components/scene-graph/SceneGraphTree";

export function HistoryTabContent() {
  const { data: historyData } = useInferenceHistory(0, 20);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const rows = historyData?.data || [];

  const historyObjects: DetectedObject[] = useMemo(() => {
    if (selectedIdx === null || !rows[selectedIdx]) return [];
    try {
      return JSON.parse(rows[selectedIdx].objects_json);
    } catch {
      return [];
    }
  }, [selectedIdx, rows]);

  const tree = useMemo(() => buildBasicTree(historyObjects), [historyObjects]);

  return (
    <div className="space-y-4">
      {rows.length === 0 ? (
        <Card className="border-foreground/10 bg-card/50">
          <CardContent className="py-12">
            <p className="text-sm text-muted-foreground font-mono text-center">
              No inference history available.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-5">
          {/* History list */}
          <Card className="lg:col-span-2 border-foreground/10 bg-card/50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">History</CardTitle>
                <Badge variant="outline" className="text-[10px] font-mono">
                  {rows.length} results
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 max-h-[400px] overflow-y-auto pr-1">
                {rows.map((row, idx) => (
                  <button
                    key={row.id}
                    onClick={() => setSelectedIdx(idx)}
                    className={`w-full text-left px-3 py-2.5 rounded-md text-xs font-mono transition-colors ${
                      selectedIdx === idx
                        ? "bg-primary/10 text-primary border border-primary/20"
                        : "hover:bg-foreground/5 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-foreground/80 truncate">
                        {row.model}
                      </span>
                      <span className="text-muted-foreground tabular-nums ml-2">
                        {row.inference_ms.toFixed(0)}ms
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span>
                        <Eye className="h-3 w-3 inline mr-0.5" />
                        {row.object_count} objects
                      </span>
                      <span>
                        {new Date(row.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Scene graph for selected history item */}
          <Card className="lg:col-span-3 border-foreground/10 bg-card/50">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-terminal-green" />
                <CardTitle className="text-sm">Scene Graph</CardTitle>
                {historyObjects.length > 0 && (
                  <Badge
                    variant="outline"
                    className="text-[10px] font-mono border-terminal-green/30 text-terminal-green"
                  >
                    {historyObjects.length} objects
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div
                className="max-h-[400px] overflow-y-auto"
                role="tree"
                aria-label="Historical scene graph"
              >
                {tree.length === 0 ? (
                  <p className="text-xs text-muted-foreground font-mono py-8 text-center">
                    {selectedIdx === null
                      ? "Select a result to view its scene graph."
                      : "No objects in this result."}
                  </p>
                ) : (
                  <AnimatePresence>
                    {tree.map((node, i) => (
                      <TreeNodeView key={node.id} node={node} index={i} />
                    ))}
                  </AnimatePresence>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
