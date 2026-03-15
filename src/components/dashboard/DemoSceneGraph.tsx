import { motion, AnimatePresence } from "framer-motion";
import { usePerceptionStream } from "@/hooks/usePerceptionStream";
import type { SceneGraphNode, SpatialRelationship } from "@/types/openeye";

interface TreeNodeData {
  id: string;
  label: string;
  type: "object" | "relation" | "hazard" | "root";
  children: TreeNodeData[];
}

const typeStyles = {
  root: "text-terminal-fg",
  object: "text-terminal-green",
  relation: "text-terminal-fg",
  hazard: "text-terminal-red",
};

function buildTree(
  nodes: SceneGraphNode[],
  relationships: SpatialRelationship[],
  hazardIds: Set<string>,
): TreeNodeData[] {
  if (nodes.length === 0) return [];

  // Build parent lookup from ON relationships
  const parentMap = new Map<string, string>();
  for (const rel of relationships) {
    if (rel.relation === "ON") {
      parentMap.set(rel.subject_id, rel.object_id);
    }
  }

  // Build node map
  const nodeMap = new Map<string, SceneGraphNode>();
  for (const n of nodes) nodeMap.set(n.track_id, n);

  // Find root-level nodes (those not ON anything)
  const rootIds = nodes
    .filter((n) => !parentMap.has(n.track_id))
    .map((n) => n.track_id);

  function buildNode(trackId: string): TreeNodeData {
    const node = nodeMap.get(trackId);
    const label = node?.label || trackId;
    const isHazard = hazardIds.has(trackId);

    // Children: nodes that are ON this node
    const childIds = nodes
      .filter((n) => parentMap.get(n.track_id) === trackId)
      .map((n) => n.track_id);

    // Relationship labels for non-ON relations
    const relChildren: TreeNodeData[] = relationships
      .filter((r) => r.subject_id === trackId && r.relation !== "ON")
      .map((r) => ({
        id: `${trackId}-${r.relation}-${r.object_id}`,
        label: `${r.relation.toLowerCase()} → ${nodeMap.get(r.object_id)?.label || r.object_id}`,
        type: "relation" as const,
        children: [],
      }));

    return {
      id: trackId,
      label,
      type: isHazard ? "hazard" : "object",
      children: [...childIds.map(buildNode), ...relChildren],
    };
  }

  const tree: TreeNodeData = {
    id: "scene",
    label: "scene",
    type: "root",
    children: rootIds.map(buildNode),
  };

  return [tree];
}

function TreeNodeView({
  node,
  depth = 0,
  index = 0,
}: {
  node: TreeNodeData;
  depth?: number;
  index?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -6 }}
      transition={{ delay: index * 0.02, duration: 0.15, ease: [0.2, 0.8, 0.2, 1] }}
      className="font-mono text-sm"
      style={{ paddingLeft: depth * 20 }}
    >
      <div className="flex items-center gap-2 py-0.5">
        {depth > 0 && <span className="text-terminal-muted">├─</span>}
        <span className={typeStyles[node.type]}>{node.label}</span>
        {node.type === "hazard" && (
          <span className="text-[10px] bg-terminal-red/20 text-terminal-red px-1.5 py-0.5 rounded-inner uppercase tracking-wider">
            hazard
          </span>
        )}
      </div>
      <AnimatePresence>
        {node.children.map((child, i) => (
          <TreeNodeView
            key={child.id}
            node={child}
            depth={depth + 1}
            index={index + i + 1}
          />
        ))}
      </AnimatePresence>
    </motion.div>
  );
}

export function DemoSceneGraph() {
  const { latestFrame } = usePerceptionStream();

  const sceneGraph = latestFrame?.scene_graph;
  const hazardIds = new Set(
    latestFrame?.safety_alerts.map((a) => a.human_track_id) || [],
  );

  const tree = sceneGraph
    ? buildTree(sceneGraph.nodes, sceneGraph.relationships, hazardIds)
    : [];

  const objectCount = sceneGraph?.nodes.length ?? 0;

  return (
    <div className="bg-card rounded-outer border overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
          Scene Graph — {objectCount} nodes
        </span>
      </div>
      <div className="p-4 max-h-[200px] overflow-y-auto" role="tree" aria-label="Scene graph">
        {tree.length === 0 ? (
          <p className="text-sm text-muted-foreground font-mono">
            Waiting for detections...
          </p>
        ) : (
          <AnimatePresence>
            {tree.map((node, i) => (
              <TreeNodeView key={node.id} node={node} index={i} />
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
