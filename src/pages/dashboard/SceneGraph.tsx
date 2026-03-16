import { useState, useMemo } from "react";
import {
  PerceptionStreamProvider,
  usePerceptionStream,
} from "@/hooks/usePerceptionStream";
import { DemoFeed } from "@/components/dashboard/DemoFeed";
import { useInferenceHistory } from "@/hooks/useOpenEyeQueries";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Play,
  Square,
  GitBranch,
  Eye,
  Link2,
  AlertTriangle,
  Crosshair,
} from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import type { DetectedObject } from "@/types/openeye";

import {
  TreeNodeView,
  buildRichTree,
  buildBasicTree,
} from "@/components/scene-graph/SceneGraphTree";
import { NodeInspector } from "@/components/scene-graph/NodeInspector";
import { RelationshipsTable } from "@/components/scene-graph/RelationshipsTable";
import { StatsRow } from "@/components/scene-graph/StatsRow";

/* ------------------------------------------------------------------ */
/*  Live Tab Content                                                    */
/* ------------------------------------------------------------------ */

function LiveTabContent() {
  const { isStreaming, latestFrame, metrics } = usePerceptionStream();

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const sceneGraph = latestFrame?.scene_graph;
  const hazardIds = useMemo(
    () => new Set(latestFrame?.safety_alerts.map((a) => a.human_track_id) || []),
    [latestFrame],
  );

  const tree = useMemo(
    () => (sceneGraph ? buildRichTree(sceneGraph, hazardIds) : []),
    [sceneGraph, hazardIds],
  );

  const selectedSceneNode = useMemo(() => {
    if (!selectedNodeId || !sceneGraph) return null;
    return sceneGraph.nodes.find((n) => n.track_id === selectedNodeId) ?? null;
  }, [selectedNodeId, sceneGraph]);

  return (
    <div className="space-y-4">
      {/* Camera Feed */}
      <DemoFeed />

      {/* Stats Row */}
      <StatsRow frame={latestFrame} metrics={metrics} />

      {/* Main panels: Tree + Inspector */}
      <div className="grid gap-4 lg:grid-cols-5">
        {/* Scene Graph Tree */}
        <Card className="lg:col-span-3 border-foreground/10 bg-card/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-terminal-green" />
                <CardTitle className="text-sm">Scene Graph</CardTitle>
                {sceneGraph && (
                  <Badge
                    variant="outline"
                    className="text-[10px] font-mono border-terminal-green/30 text-terminal-green"
                  >
                    {sceneGraph.nodes.length} nodes
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-h-[360px] overflow-y-auto" role="tree" aria-label="Scene graph">
              {tree.length === 0 ? (
                <p className="text-xs text-muted-foreground font-mono py-8 text-center">
                  {isStreaming
                    ? "Waiting for scene graph data..."
                    : "Start camera to build scene graph."}
                </p>
              ) : (
                <AnimatePresence>
                  {tree.map((node, i) => (
                    <TreeNodeView
                      key={node.id}
                      node={node}
                      index={i}
                      selectedId={selectedNodeId}
                      onSelect={setSelectedNodeId}
                    />
                  ))}
                </AnimatePresence>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Object Inspector */}
        <Card className="lg:col-span-2 border-foreground/10 bg-card/50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Crosshair className="h-4 w-4 text-blue-400" />
              <CardTitle className="text-sm">Inspector</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <NodeInspector node={selectedSceneNode} frame={latestFrame} />
          </CardContent>
        </Card>
      </div>

      {/* Spatial Relationships */}
      <Card className="border-foreground/10 bg-card/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-blue-400" />
              <CardTitle className="text-sm">Spatial Relationships</CardTitle>
            </div>
            {sceneGraph && sceneGraph.relationships.length > 0 && (
              <Badge
                variant="outline"
                className="text-[10px] font-mono border-blue-500/30 text-blue-400"
              >
                {sceneGraph.relationships.length} relations
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <RelationshipsTable
            relationships={sceneGraph?.relationships ?? []}
            nodes={sceneGraph?.nodes ?? []}
          />
        </CardContent>
      </Card>

      {/* Safety Alerts */}
      {latestFrame && latestFrame.safety_alerts.length > 0 && (
        <Card className="border-terminal-amber/20 bg-terminal-amber/5">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-terminal-amber" />
              <CardTitle className="text-sm text-terminal-amber">
                Safety Alerts
              </CardTitle>
              <Badge
                variant="outline"
                className="text-[10px] font-mono border-terminal-amber/30 text-terminal-amber"
              >
                {latestFrame.safety_alerts.length}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            {latestFrame.safety_alerts.map((alert, i) => (
              <div
                key={`${alert.human_track_id}-${i}`}
                className={`flex items-center justify-between font-mono text-xs py-1.5 px-3 rounded-md border ${
                  alert.zone === "danger"
                    ? "bg-red-500/10 border-red-500/20 text-red-400"
                    : "bg-terminal-amber/10 border-terminal-amber/20 text-terminal-amber"
                }`}
              >
                <span>{alert.message}</span>
                <div className="flex items-center gap-2">
                  <span className="tabular-nums">
                    {alert.distance_m.toFixed(2)}m
                  </span>
                  {alert.halt_recommended && (
                    <span className="text-[9px] bg-red-500/20 text-red-400 px-1 py-0.5 rounded uppercase tracking-wider animate-pulse">
                      HALT
                    </span>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  History Tab Content                                                 */
/* ------------------------------------------------------------------ */

function HistoryTabContent() {
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

/* ------------------------------------------------------------------ */
/*  Main Page                                                           */
/* ------------------------------------------------------------------ */

function SceneGraphInner() {
  const { isStreaming, startStream, stopStream, mode } = usePerceptionStream();

  const handleStart = async () => {
    try {
      await startStream();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start camera");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">Scene Graph</h1>
          {isStreaming && (
            <Badge
              variant="outline"
              className="text-[10px] font-mono border-terminal-green/30 text-terminal-green animate-pulse"
            >
              LIVE
            </Badge>
          )}
          {mode === "replay" && (
            <Badge
              variant="outline"
              className="text-[10px] font-mono border-terminal-amber/30 text-terminal-amber"
            >
              REPLAY
            </Badge>
          )}
        </div>
        <Button
          onClick={isStreaming ? stopStream : handleStart}
          variant={isStreaming ? "destructive" : "default"}
          className="gap-2"
        >
          {isStreaming ? (
            <>
              <Square className="h-4 w-4" />
              Stop
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              Start Camera
            </>
          )}
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="live">
        <TabsList>
          <TabsTrigger value="live">
            <GitBranch className="h-3.5 w-3.5 mr-1.5" />
            Live
          </TabsTrigger>
          <TabsTrigger value="history">
            <Eye className="h-3.5 w-3.5 mr-1.5" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="live" className="mt-4">
          <LiveTabContent />
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <HistoryTabContent />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function SceneGraphPage() {
  return (
    <PerceptionStreamProvider>
      <SceneGraphInner />
    </PerceptionStreamProvider>
  );
}
