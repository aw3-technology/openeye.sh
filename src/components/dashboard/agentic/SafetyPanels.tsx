import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Shield } from "lucide-react";
import type { AgenticFrame } from "./types";

interface SafetyAlertsPanelProps {
  latestFrame: AgenticFrame | null;
  hasSafetyAlerts: boolean;
}

export function SafetyAlertsPanel({ latestFrame, hasSafetyAlerts }: SafetyAlertsPanelProps) {
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
                <Badge variant="destructive" className="ml-auto text-[10px]">
                  {latestFrame?.safety_alerts.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                {latestFrame?.safety_alerts.map((alert) => (
                  <div
                    key={`${alert.zone}-${alert.message}`}
                    className={`flex items-center gap-2 text-xs font-mono p-2 rounded-md ${
                      alert.halt_recommended
                        ? "bg-terminal-red/10 border border-terminal-red/20"
                        : "bg-terminal-amber/5 border border-terminal-amber/10"
                    }`}
                  >
                    <AlertTriangle
                      className={`h-3 w-3 shrink-0 ${
                        alert.halt_recommended ? "text-terminal-red animate-pulse" : "text-terminal-amber"
                      }`}
                    />
                    <div className="flex-1">
                      <span className={alert.halt_recommended ? "text-terminal-red" : "text-terminal-amber"}>
                        {alert.message}
                      </span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[9px] text-muted-foreground">zone: {alert.zone}</span>
                        {alert.halt_recommended && (
                          <Badge variant="destructive" className="text-[9px] h-4">
                            HALT RECOMMENDED
                          </Badge>
                        )}
                      </div>
                    </div>
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

interface SafetyZonesPanelProps {
  latestFrame: AgenticFrame | null;
  hasSafetyZones: boolean;
}

export function SafetyZonesPanel({ latestFrame, hasSafetyZones }: SafetyZonesPanelProps) {
  return (
    <AnimatePresence>
      {hasSafetyZones && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
        >
          <Card className="border-blue-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-mono flex items-center gap-2 text-blue-400">
                <Shield className="h-4 w-4" />
                SAFETY ZONES
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                {latestFrame?.safety_zones.map((zone) => {
                  const zoneColor =
                    zone.distance_m < 0.5
                      ? "terminal-red"
                      : zone.distance_m < 1.5
                      ? "terminal-amber"
                      : "terminal-green";
                  return (
                    <div
                      key={zone.zone}
                      className="flex items-center justify-between py-1.5 px-2 rounded-md bg-muted/30 font-mono text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full bg-${zoneColor}`} />
                        <span>{zone.zone}</span>
                      </div>
                      <span className={`tabular-nums font-semibold text-${zoneColor}`}>
                        {zone.distance_m.toFixed(1)}m
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
