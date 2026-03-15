import { motion, AnimatePresence } from "framer-motion";
import { usePerceptionStream } from "@/hooks/usePerceptionStream";

const priorityConfig = (priority: number) => {
  if (priority >= 1.0) return { color: "text-terminal-red", bg: "bg-terminal-red/10", label: "HALT" };
  if (priority >= 0.8) return { color: "text-terminal-amber", bg: "bg-terminal-amber/10", label: "SLOW" };
  return { color: "text-terminal-green", bg: "bg-terminal-green/10", label: "ACT" };
};

export function ActionPlanPanel() {
  const { latestFrame } = usePerceptionStream();
  const actions = latestFrame?.action_suggestions ?? [];
  const sorted = [...actions].sort((a, b) => b.priority - a.priority);

  return (
    <div className="bg-card rounded-outer border overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
          Action Plan — {actions.length} actions
        </span>
      </div>
      <div className="p-4 space-y-2 max-h-[180px] overflow-y-auto">
        <AnimatePresence mode="popLayout">
          {sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground font-mono">
              No actions suggested.
            </p>
          ) : (
            sorted.map((action, i) => {
              const cfg = priorityConfig(action.priority);
              return (
                <motion.div
                  key={`${action.action}-${action.target_id ?? i}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.15, delay: i * 0.03 }}
                  className={`flex items-start gap-3 p-2 rounded-inner ${cfg.bg}`}
                >
                  <span className={`font-mono text-[10px] font-bold uppercase tracking-wider mt-0.5 ${cfg.color}`}>
                    {cfg.label}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className={`font-mono text-xs font-medium ${cfg.color}`}>
                      {action.action.replace(/_/g, " ").toUpperCase()}
                      {action.target_id && (
                        <span className="text-terminal-muted ml-1">→ {action.target_id}</span>
                      )}
                    </div>
                    <div className="font-mono text-[10px] text-terminal-muted mt-0.5 truncate">
                      {action.reason}
                    </div>
                  </div>
                  <span className="font-mono text-[10px] tabular-nums text-terminal-muted">
                    {action.priority.toFixed(1)}
                  </span>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
