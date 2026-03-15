import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import type { AgenticFrame } from "@/types/agentic";

interface SafetyAlertsCardProps {
  frame: AgenticFrame | null;
}

export function SafetyAlertsCard({ frame }: SafetyAlertsCardProps) {
  const hasSafetyAlerts = (frame?.safety_alerts?.length ?? 0) > 0;

  return (
    <AnimatePresence>
      {hasSafetyAlerts && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
        >
          <Card className="border-terminal-red/30 bg-terminal-red/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-mono flex items-center gap-2 text-terminal-red">
                <AlertTriangle className="h-4 w-4" />
                SAFETY ALERTS
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                {frame?.safety_alerts.map((alert) => (
                  <div
                    key={`${alert.zone}-${alert.message}`}
                    className="flex items-center gap-2 text-xs font-mono"
                  >
                    <AlertTriangle
                      className={`h-3 w-3 shrink-0 ${
                        alert.halt_recommended ? "text-terminal-red" : "text-terminal-amber"
                      }`}
                    />
                    <span className={alert.halt_recommended ? "text-terminal-red" : "text-terminal-amber"}>
                      {alert.message}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
