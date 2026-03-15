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
  Activity,
  Zap,
  Eye,
  Link2,
  AlertTriangle,
  Box,
  ArrowRight,
  Layers,
  Crosshair,
  ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import type {
  DetectedObject,
  SceneGraphData,
  SceneGraphNode,
  SpatialRelationship,
  PerceptionFrame,
} from "@/types/openeye";

/* ------------------------------------------------------------------ */
/*  Scene Graph Tree Visualization                                      */
/* ------------------------------------------------------------------ */

interface TreeNodeData {
  id: string;
  label: string;
  type: "object" | "relation" | "hazard" | "root";
  confidence?: number;
  position3d?: { x: number; y: number; z: number } | null;
  childCount: number;
  relationCount: number;
  children: TreeNodeData[];
}

const typeColors = {
  root: "text-foreground",
  object: "text-terminal-green",
  relation: "text-terminal-muted",
  hazard: "text-terminal-amber",
};

const typeDotColors = {
  root: "bg-foreground",
  object: "bg-terminal-green",
  relation: "bg-terminal-muted",
  hazard: "bg-terminal-amber",
};

function buildRichTree(
  sceneGraph: SceneGraphData,
  hazardTrackIds: Set<string>,
): TreeNodeData[] {
  if (sceneGraph.nodes.length === 0) return [];

  const nodeMap = new Map<string, SceneGraphNode>();
  for (const n of sceneGraph.nodes) nodeMap.set(n.track_id, n);

  // Find ON relationships to determine parent-child hierarchy
  const parentMap = new Map<string, string>();
  for (const rel of sceneGraph.relationships) {
    if (rel.relation === "ON") {
      parentMap.set(rel.subject_id, rel.object_id);
    }
  }

  // Root nodes: those not ON anything
  const rootIds = sceneGraph.nodes
    .filter((n) => !parentMap.has(n.track_id))
    .map((n) => n.track_id);

  function buildNode(trackId: string): TreeNodeData {
    const node = nodeMap.get(trackId);
    const label = node?.label || trackId;
    const isHazard = hazardTrackIds.has(trackId);

    // Child objects sitting ON this one
    const childObjectIds = sceneGraph.nodes
      .filter((n) => parentMap.get(n.track_id) === trackId)
      .map((n) => n.track_id);

    // Non-ON relationships from this node
    const relChildren: TreeNodeData[] = sceneGraph.relationships
      .filter((r) => r.subject_id === trackId && r.relation !== "ON")
      .map((r) => ({
        id: `${trackId}-${r.relation}-${r.object_id}`,
        label: `${r.relation.toLowerCase().replace(/_/g, " ")} ${nodeMap.get(r.object_id)?.label || r.object_id}`,
        type: "relation" as const,
        confidence: r.confidence,
        position3d: null,
        childCount: 0,
        relationCount: 0,
        children: [],
      }));

    return {
      id: trackId,
      label,
      type: isHazard ? "hazard" : "object",
      confidence: undefined,
      position3d: node?.position_3d,
      childCount: childObjectIds.length,
      relationCount: relChildren.length,
      children: [...childObjectIds.map(buildNode), ...relChildren],
    };
  }

  return [
    {
      id: "scene-root",
      label: "scene",
      type: "root",
      childCount: rootIds.length,
      relationCount: 0,
      children: rootIds.map(buildNode),
    },
  ];
}

// Fallback: build tree from basic DetectedObject[] (for history tab)
function buildBasicTree(objects: DetectedObject[]): TreeNodeData[] {
  if (objects.length === 0) return [];

  const children: TreeNodeData[] = objects.map((obj, i) => {
    const isHazard =
      obj.label.toLowerCase().includes("knife") || obj.confidence < 0.5;

    const relChildren: TreeNodeData[] = [];
    objects.forEach((other, j) => {
      if (i === j) return;
      const dx = Math.abs(obj.bbox.x - other.bbox.x);
      const dy = Math.abs(obj.bbox.y - other.bbox.y);
      if (dx < 0.15 && dy < 0.15) {
        relChildren.push({
          id: `${i}-near-${j}`,
          label: `near ${other.label}`,
          type: "relation",
          confidence: undefined,
          position3d: null,
          childCount: 0,
          relationCount: 0,
          children: [],
        });
      }
    });

    return {
      id: obj.track_id || `obj-${i}`,
      label: obj.label,
      type: isHazard ? "hazard" : "object",
      confidence: obj.confidence,
      position3d: null,
      childCount: 0,
      relationCount: relChildren.length,
      children: relChildren,
    };
  });

  return [
    {
      id: "scene-root",
      label: "scene",
      type: "root",
      childCount: children.length,
      relationCount: 0,
      children,
    },
  ];
}

function TreeNodeView({
  node,
  depth = 0,
  index = 0,
  selectedId,
  onSelect,
}: {
  node: TreeNodeData;
  depth?: number;
  index?: number;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const hasChildren = node.children.length > 0;
  const isSelected = selectedId === node.id;

  return (
    <motion.div
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -4 }}
      transition={{
        delay: index * 0.015,
        duration: 0.12,
        ease: [0.2, 0.8, 0.2, 1],
      }}
    >
      <div
        className={`flex items-center gap-1.5 py-1 px-2 rounded-md cursor-pointer transition-colors ${
          isSelected
            ? "bg-primary/10 border border-primary/20"
            : "hover:bg-foreground/5 border border-transparent"
        }`}
        style={{ paddingLeft: depth * 18 + 8 }}
        onClick={() => {
          if (node.type !== "relation") onSelect?.(node.id);
        }}
      >
        {/* Expand/collapse toggle */}
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setCollapsed((c) => !c);
            }}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronRight
              className={`h-3 w-3 transition-transform ${collapsed ? "" : "rotate-90"}`}
            />
          </button>
        ) : (
          <span className="w-3" />
        )}

        {/* Node dot */}
        <span
          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${typeDotColors[node.type]}`}
        />

        {/* Label */}
        <span className={`font-mono text-xs ${typeColors[node.type]}`}>
          {node.label}
        </span>

        {/* Confidence */}
        {node.confidence !== undefined && (
          <span className="text-[10px] text-muted-foreground tabular-nums font-mono">
            {(node.confidence * 100).toFixed(0)}%
          </span>
        )}

        {/* Badges */}
        {node.type === "hazard" && (
          <span className="text-[9px] bg-terminal-amber/20 text-terminal-amber px-1 py-0.5 rounded uppercase tracking-wider font-mono">
            hazard
          </span>
        )}

        {/* 3D position indicator */}
        {node.position3d && (
          <span className="text-[9px] bg-blue-500/10 text-blue-400 px-1 py-0.5 rounded font-mono">
            3D
          </span>
        )}
      </div>

      {/* Children */}
      {!collapsed && (
        <AnimatePresence>
          {node.children.map((child, i) => (
            <TreeNodeView
              key={child.id}
              node={child}
              depth={depth + 1}
              index={index + i + 1}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </AnimatePresence>
      )}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Relationships Table                                                 */
/* ------------------------------------------------------------------ */

function RelationshipsTable({
  relationships,
  nodes,
}: {
  relationships: SpatialRelationship[];
  nodes: SceneGraphNode[];
}) {
  const nodeMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const n of nodes) m.set(n.track_id, n.label);
    return m;
  }, [nodes]);

  if (relationships.length === 0) {
    return (
      <p className="text-xs text-muted-foreground font-mono py-6 text-center">
        No spatial relationships detected.
      </p>
    );
  }

  return (
    <div className="space-y-1 max-h-[280px] overflow-y-auto pr-1">
      {relationships.map((rel, i) => {
        const subLabel = nodeMap.get(rel.subject_id) || rel.subject_id;
        const objLabel = nodeMap.get(rel.object_id) || rel.object_id;
        const relDisplay = rel.relation.toLowerCase().replace(/_/g, " ");

        return (
          <motion.div
            key={`${rel.subject_id}-${rel.relation}-${rel.object_id}-${i}`}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.02, duration: 0.12 }}
            className="flex items-center gap-2 font-mono text-xs py-1.5 px-3 rounded-md bg-foreground/5 border border-foreground/5"
          >
            <span className="text-terminal-green truncate">{subLabel}</span>
            <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            <Badge
              variant="outline"
              className="text-[9px] font-mono px-1.5 py-0 border-foreground/10 text-foreground/70 flex-shrink-0"
            >
              {relDisplay}
            </Badge>
            <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            <span className="text-terminal-green truncate">{objLabel}</span>
            <span className="ml-auto text-[10px] text-muted-foreground tabular-nums flex-shrink-0">
              {(rel.confidence * 100).toFixed(0)}%
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Object Inspector Panel                                              */
/* ------------------------------------------------------------------ */

function ObjectInspector({
  node,
  frame,
}: {
  node: SceneGraphNode | null;
  frame: PerceptionFrame | null;
}) {
  if (!node) {
    return (
      <p className="text-xs text-muted-foreground font-mono py-6 text-center">
        Select a node in the tree to inspect.
      </p>
    );
  }

  const obj3d = frame?.objects.find((o) => o.track_id === node.track_id);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Box className="h-4 w-4 text-terminal-green" />
        <span className="font-mono text-sm text-terminal-green font-semibold">
          {node.label}
        </span>
        <span className="text-[10px] font-mono text-muted-foreground">
          {node.track_id}
        </span>
      </div>

      {/* Properties grid */}
      <div className="grid grid-cols-2 gap-2">
        {obj3d && (
          <>
            <div className="bg-foreground/5 rounded-md p-2 border border-foreground/5">
              <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1">
                Confidence
              </div>
              <div className="font-mono text-sm tabular-nums text-terminal-green">
                {(obj3d.confidence * 100).toFixed(1)}%
              </div>
            </div>

            {obj3d.depth_m != null && (
              <div className="bg-foreground/5 rounded-md p-2 border border-foreground/5">
                <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1">
                  Depth
                </div>
                <div className="font-mono text-sm tabular-nums text-blue-400">
                  {obj3d.depth_m.toFixed(2)}m
                </div>
              </div>
            )}

            <div className="bg-foreground/5 rounded-md p-2 border border-foreground/5">
              <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1">
                Manipulable
              </div>
              <div className="font-mono text-sm">
                {obj3d.is_manipulable ? (
                  <span className="text-terminal-green">Yes</span>
                ) : (
                  <span className="text-muted-foreground">No</span>
                )}
              </div>
            </div>

            {obj3d.grasp_points.length > 0 && (
              <div className="bg-foreground/5 rounded-md p-2 border border-foreground/5">
                <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1">
                  Grasp Points
                </div>
                <div className="font-mono text-sm tabular-nums text-purple-400">
                  {obj3d.grasp_points.length}
                </div>
              </div>
            )}
          </>
        )}

        {/* 3D Position */}
        {node.position_3d && (
          <div className="bg-foreground/5 rounded-md p-2 border border-foreground/5 col-span-2">
            <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1">
              3D Position
            </div>
            <div className="font-mono text-xs tabular-nums text-blue-400 flex gap-3">
              <span>
                x: {node.position_3d.x.toFixed(3)}
              </span>
              <span>
                y: {node.position_3d.y.toFixed(3)}
              </span>
              <span>
                z: {node.position_3d.z.toFixed(3)}
              </span>
            </div>
          </div>
        )}

        {/* BBox */}
        {obj3d && (
          <div className="bg-foreground/5 rounded-md p-2 border border-foreground/5 col-span-2">
            <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1">
              Bounding Box
            </div>
            <div className="font-mono text-xs tabular-nums text-foreground/70 flex gap-3">
              <span>x1: {obj3d.bbox.x1.toFixed(3)}</span>
              <span>y1: {obj3d.bbox.y1.toFixed(3)}</span>
              <span>x2: {obj3d.bbox.x2.toFixed(3)}</span>
              <span>y2: {obj3d.bbox.y2.toFixed(3)}</span>
            </div>
          </div>
        )}

        {/* Children */}
        {node.children.length > 0 && (
          <div className="bg-foreground/5 rounded-md p-2 border border-foreground/5 col-span-2">
            <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1">
              Children
            </div>
            <div className="font-mono text-xs text-foreground/70">
              {node.children.join(", ")}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Stats Row                                                           */
/* ------------------------------------------------------------------ */

function StatsRow({
  frame,
  metrics,
}: {
  frame: PerceptionFrame | null;
  metrics: { fps: number; latency_ms: number; frame_count: number };
}) {
  const nodeCount = frame?.scene_graph.nodes.length ?? 0;
  const relCount = frame?.scene_graph.relationships.length ?? 0;
  const hazardCount = frame?.safety_alerts.length ?? 0;
  const has3D = frame?.depth_available ?? false;

  const stats = [
    {
      label: "FPS",
      value: String(metrics.fps),
      icon: Activity,
      color:
        metrics.fps > 20
          ? "text-terminal-green"
          : metrics.fps > 10
            ? "text-terminal-amber"
            : "text-red-400",
    },
    {
      label: "Latency",
      value: `${metrics.latency_ms.toFixed(0)}ms`,
      icon: Zap,
      color:
        metrics.latency_ms > 0 && metrics.latency_ms < 50
          ? "text-terminal-green"
          : metrics.latency_ms < 100
            ? "text-terminal-amber"
            : "text-red-400",
    },
    {
      label: "Nodes",
      value: String(nodeCount),
      icon: Box,
      color: "text-terminal-green",
    },
    {
      label: "Relations",
      value: String(relCount),
      icon: Link2,
      color: "text-blue-400",
    },
    {
      label: "Hazards",
      value: String(hazardCount),
      icon: AlertTriangle,
      color: hazardCount > 0 ? "text-terminal-amber" : "text-terminal-green",
    },
    {
      label: "Depth",
      value: has3D ? "3D" : "2D",
      icon: Layers,
      color: has3D ? "text-blue-400" : "text-muted-foreground",
    },
  ];

  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="bg-card rounded-md border px-3 py-2 text-center"
        >
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <stat.icon className="h-3 w-3 text-muted-foreground" />
            <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
              {stat.label}
            </span>
          </div>
          <div className={`font-mono text-sm tabular-nums font-semibold ${stat.color}`}>
            {stat.value}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Live Tab Content                                                    */
/* ------------------------------------------------------------------ */

function LiveTabContent() {
  const { isStreaming, startStream, stopStream, latestFrame, metrics } =
    usePerceptionStream();

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const sceneGraph = latestFrame?.scene_graph;
  const hazardIds = useMemo(
    () => new Set(latestFrame?.safety_alerts.map((a) => a.human_track_id) || []),
    [latestFrame],
  );

  const tree = useMemo(
    () =>
      sceneGraph
        ? buildRichTree(sceneGraph, hazardIds)
        : [],
    [sceneGraph, hazardIds],
  );

  const selectedSceneNode = useMemo(() => {
    if (!selectedNodeId || !sceneGraph) return null;
    return sceneGraph.nodes.find((n) => n.track_id === selectedNodeId) ?? null;
  }, [selectedNodeId, sceneGraph]);

  const handleStart = async () => {
    try {
      await startStream();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start camera");
    }
  };

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
            <ObjectInspector node={selectedSceneNode} frame={latestFrame} />
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
