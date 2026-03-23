import { useState, useMemo } from "react";
import { usePerceptionStream } from "@/hooks/usePerceptionStream";
import { DemoFeed } from "@/components/dashboard/DemoFeed";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  GitBranch,
  Link2,
  AlertTriangle,
  Crosshair,
} from "lucide-react";
import { AnimatePresence } from "framer-motion";

import {
  TreeNodeView,
  buildRichTree,
} from "@/components/scene-graph/SceneGraphTree";
import { NodeInspector } from "@/components/scene-graph/NodeInspector";
import { RelationshipsTable } from "@/components/scene-graph/RelationshipsTable";
import { StatsRow } from "@/components/scene-graph/StatsRow";

export function LiveTabContent() {
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
