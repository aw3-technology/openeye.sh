import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type {
  SceneGraphData,
  SceneGraphNode,
  DetectedObject,
} from "@/types/openeye";

/* ------------------------------------------------------------------ */
/*  Types & Constants                                                    */
/* ------------------------------------------------------------------ */

export interface TreeNodeData {
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

/* ------------------------------------------------------------------ */
/*  Tree Builders                                                        */
/* ------------------------------------------------------------------ */

export function buildRichTree(
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

export function buildBasicTree(objects: DetectedObject[]): TreeNodeData[] {
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

/* ------------------------------------------------------------------ */
/*  Tree Node View                                                       */
/* ------------------------------------------------------------------ */

export function TreeNodeView({
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
