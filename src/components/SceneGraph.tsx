import { motion } from "framer-motion";

interface Node {
  label: string;
  type: "object" | "relation" | "hazard";
  children?: Node[];
}

const sceneData: Node[] = [
  {
    label: "workspace",
    type: "object",
    children: [
      {
        label: "apple_01",
        type: "object",
        children: [{ label: "near → knife_01", type: "hazard" }],
      },
      {
        label: "knife_01",
        type: "hazard",
        children: [{ label: "on → table_surface", type: "relation" }],
      },
      {
        label: "cup_01",
        type: "object",
        children: [{ label: "near_edge → table", type: "hazard" }],
      },
      {
        label: "book_01",
        type: "object",
        children: [{ label: "on → table_surface", type: "relation" }],
      },
    ],
  },
];

const typeStyles = {
  object: "text-terminal-green",
  relation: "text-terminal-fg",
  hazard: "text-terminal-amber",
};

function TreeNode({ node, depth = 0, index = 0 }: { node: Node; depth?: number; index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.05, duration: 0.15, ease: [0.2, 0.8, 0.2, 1] }}
      className="font-mono text-sm"
      style={{ paddingLeft: depth * 20 }}
    >
      <div className="flex items-center gap-2 py-0.5">
        {depth > 0 && <span className="text-terminal-muted">├─</span>}
        <span className={typeStyles[node.type]}>{node.label}</span>
        {node.type === "hazard" && (
          <span className="text-[10px] bg-terminal-amber/20 text-terminal-amber px-1.5 py-0.5 rounded-inner uppercase tracking-wider">
            hazard
          </span>
        )}
      </div>
      {node.children?.map((child, i) => (
        <TreeNode key={child.label} node={child} depth={depth + 1} index={index + i + 1} />
      ))}
    </motion.div>
  );
}

export function SceneGraph() {
  return (
    <div className="bg-card rounded-outer border overflow-hidden" role="tree" aria-label="Scene graph">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
          Scene Graph — workspace
        </span>
      </div>
      <div className="p-4 md:p-6">
        {sceneData.map((node, i) => (
          <TreeNode key={node.label} node={node} index={i} />
        ))}
      </div>
    </div>
  );
}
