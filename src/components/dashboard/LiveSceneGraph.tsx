import { useMemo } from "react";
import { motion } from "framer-motion";
import type { DetectedObject } from "@/types/openeye";
import { ease } from "@/lib/motion";

interface Node {
  label: string;
  type: "object" | "relation" | "hazard";
  confidence?: number;
  children?: Node[];
}

const typeStyles = {
  object: "text-terminal-green",
  relation: "text-terminal-fg",
  hazard: "text-terminal-amber",
};

function buildSceneTree(objects: DetectedObject[]): Node[] {
  if (objects.length === 0) return [];

  const children: Node[] = objects.map((obj) => {
    const isHazard = obj.label.toLowerCase().includes("knife") || obj.confidence < 0.5;
    const node: Node = {
      label: obj.label,
      type: isHazard ? "hazard" : "object",
      confidence: obj.confidence,
      children: [],
    };

    // Add spatial relation hints for nearby objects
    objects.forEach((other) => {
      if (other === obj) return;
      const dx = Math.abs(obj.bbox.x - other.bbox.x);
      const dy = Math.abs(obj.bbox.y - other.bbox.y);
      if (dx < 0.15 && dy < 0.15) {
        node.children!.push({
          label: `near → ${other.label}`,
          type: isHazard || other.confidence < 0.5 ? "hazard" : "relation",
        });
      }
    });

    if (node.children!.length === 0) delete node.children;
    return node;
  });

  return [{ label: "scene", type: "object", children }];
}

function TreeNode({ node, depth = 0, index = 0 }: { node: Node; depth?: number; index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03, duration: 0.15, ease }}
      className="font-mono text-sm"
      style={{ paddingLeft: depth * 20 }}
    >
      <div className="flex items-center gap-2 py-0.5">
        {depth > 0 && <span className="text-terminal-muted">├─</span>}
        <span className={typeStyles[node.type]}>{node.label}</span>
        {node.confidence !== undefined && (
          <span className="text-[10px] text-muted-foreground tabular-nums">
            [{(node.confidence * 100).toFixed(1)}%]
          </span>
        )}
        {node.type === "hazard" && (
          <span className="text-[10px] bg-terminal-amber/20 text-terminal-amber px-1.5 py-0.5 rounded-inner uppercase tracking-wider">
            hazard
          </span>
        )}
      </div>
      {node.children?.map((child, i) => (
        <TreeNode key={`${child.label}-${i}`} node={child} depth={depth + 1} index={index + i + 1} />
      ))}
    </motion.div>
  );
}

interface LiveSceneGraphProps {
  objects: DetectedObject[];
}

export function LiveSceneGraph({ objects }: LiveSceneGraphProps) {
  const tree = useMemo(() => buildSceneTree(objects), [objects]);

  return (
    <div className="bg-card rounded-outer border overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
          Scene Graph — {objects.length} objects
        </span>
      </div>
      <div className="p-4 md:p-6">
        {tree.length === 0 ? (
          <p className="text-sm text-muted-foreground font-mono">No objects detected.</p>
        ) : (
          tree.map((node, i) => <TreeNode key={node.label} node={node} index={i} />)
        )}
      </div>
    </div>
  );
}
