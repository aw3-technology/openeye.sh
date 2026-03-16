import { Box } from "lucide-react";
import type { SceneGraphNode, PerceptionFrame } from "@/types/openeye";

export function NodeInspector({
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
