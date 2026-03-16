import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eye, Sparkles } from "lucide-react";
import type { AgenticFrame } from "./types";

interface ScenePanelProps {
  latestFrame: AgenticFrame | null;
  hasChangeAlerts: boolean;
}

export function ScenePanel({ latestFrame, hasChangeAlerts }: ScenePanelProps) {
  return (
    <>
      {/* Scene Description */}
      {latestFrame?.scene_description && (
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono flex items-center gap-2 text-foreground/80">
              <Eye className="h-4 w-4" />
              SCENE
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground leading-relaxed">{latestFrame.scene_description}</p>
          </CardContent>
        </Card>
      )}

      {/* Change Alerts */}
      <AnimatePresence>
        {hasChangeAlerts && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <Card className="border-purple-500/20 bg-purple-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-mono flex items-center gap-2 text-purple-400">
                  <Sparkles className="h-4 w-4" />
                  SCENE CHANGES
                  <Badge variant="outline" className="ml-auto text-[10px] border-purple-500/30 text-purple-400">
                    {latestFrame?.change_alerts.length} changes
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5">
                  {latestFrame?.change_alerts.map((change, i) => (
                    <div
                      key={`${change.change_type}-${i}`}
                      className="flex items-start gap-2 text-xs font-mono p-1.5 rounded bg-purple-500/5"
                    >
                      <Badge
                        variant="outline"
                        className="text-[9px] uppercase tracking-wider border-purple-500/30 text-purple-400 shrink-0"
                      >
                        {change.change_type.replace(/_/g, " ")}
                      </Badge>
                      <span className="text-muted-foreground line-clamp-2">{change.description}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
