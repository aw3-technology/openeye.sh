import { Shield, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { AgenticFrame } from "./constants";

export function SafetyGuardian({
  agenticFrame,
  safetyLevel,
}: {
  agenticFrame: AgenticFrame | null;
  safetyLevel: string;
}) {
  return (
    <div className="space-y-2">
      <div
        className={`flex items-center gap-2 text-[10px] uppercase tracking-wider ${
          safetyLevel === "DANGER"
            ? "text-red-400"
            : safetyLevel === "CAUTION"
              ? "text-yellow-400"
              : "text-emerald-400"
        }`}
      >
        <Shield className="h-3.5 w-3.5" />
        <span>Safety Guardian</span>
        <span
          className={`ml-auto px-2 py-0.5 rounded text-[9px] font-bold tracking-widest ${
            safetyLevel === "DANGER"
              ? "bg-red-500/20 border border-red-500/40 animate-pulse"
              : safetyLevel === "CAUTION"
                ? "bg-yellow-500/20 border border-yellow-500/40"
                : "bg-emerald-500/20 border border-emerald-500/40"
          }`}
        >
          {safetyLevel}
        </span>
      </div>

      <AnimatePresence>
        {agenticFrame?.safety_alerts &&
        agenticFrame.safety_alerts.length > 0 ? (
          <div className="space-y-1.5">
            {agenticFrame.safety_alerts.map((alert, i) => (
              <motion.div
                key={`${alert.zone}-${alert.message}-${i}`}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className={`flex items-center gap-2 text-[11px] p-2 rounded border ${
                  alert.halt_recommended
                    ? "bg-red-500/10 border-red-500/30 text-red-400"
                    : "bg-yellow-500/5 border-yellow-500/20 text-yellow-400"
                }`}
              >
                <AlertTriangle
                  className={`h-3.5 w-3.5 shrink-0 ${alert.halt_recommended ? "animate-pulse" : ""}`}
                />
                <div className="flex-1">
                  <span>{alert.message}</span>
                  {alert.halt_recommended && (
                    <span className="ml-2 text-[9px] bg-red-500/30 px-1.5 py-0.5 rounded font-bold tracking-wider">
                      HALT
                    </span>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="bg-white/5 rounded-md border border-white/10 p-3">
            <div className="flex items-center gap-2 text-[11px] text-emerald-400/50">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              All zones clear
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Safety zones */}
      {agenticFrame?.safety_zones &&
        agenticFrame.safety_zones.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {agenticFrame.safety_zones.map((zone) => {
              const cls =
                zone.distance_m < 0.5
                  ? "bg-red-500/10 border-red-500/20 text-red-400"
                  : zone.distance_m < 1.5
                    ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-400"
                    : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400";
              return (
                <div
                  key={zone.zone}
                  className={`text-[10px] px-2 py-1 rounded border tabular-nums ${cls}`}
                >
                  {zone.zone}: {zone.distance_m.toFixed(1)}m
                </div>
              );
            })}
          </div>
        )}
    </div>
  );
}
