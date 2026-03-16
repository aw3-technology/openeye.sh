import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import type { SceneGraphNode, SpatialRelationship } from "@/types/openeye";

export function RelationshipsTable({
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
