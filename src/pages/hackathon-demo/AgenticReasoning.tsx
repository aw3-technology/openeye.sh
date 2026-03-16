import { Target } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { AgenticFrame } from "./constants";

export function AgenticReasoning({
  agenticFrame,
  goal,
}: {
  agenticFrame: AgenticFrame | null;
  goal: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-[10px] text-emerald-400 uppercase tracking-wider">
        <Target className="h-3.5 w-3.5" />
        <span>Agentic Reasoning</span>
        {goal && (
          <span className="ml-auto text-white/20 truncate max-w-[160px]">
            Goal: {goal}
          </span>
        )}
      </div>

      <div className="space-y-1.5">
        <AnimatePresence mode="popLayout">
          {agenticFrame?.action_plan &&
          agenticFrame.action_plan.length > 0 ? (
            agenticFrame.action_plan
              .sort((a, b) => b.priority - a.priority)
              .slice(0, 4)
              .map((step, i) => {
                const priorityCls =
                  step.priority >= 0.8
                    ? "text-red-400"
                    : step.priority >= 0.6
                      ? "text-amber-400"
                      : "text-emerald-400";
                const badgeCls =
                  step.priority >= 0.8
                    ? "bg-red-500/20 text-red-400"
                    : step.priority >= 0.6
                      ? "bg-amber-500/20 text-amber-400"
                      : "bg-emerald-500/20 text-emerald-400";
                return (
                  <motion.div
                    key={`${step.action}-${i}`}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-start gap-2 p-2 rounded bg-white/5 border border-white/10"
                  >
                    <span
                      className={`text-[10px] font-bold tabular-nums mt-0.5 ${priorityCls}`}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span
                        className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${badgeCls}`}
                      >
                        {step.action.replace(/_/g, " ")}
                      </span>
                      <p className="text-[11px] text-white/50 mt-1 line-clamp-2">
                        {step.reason}
                      </p>
                    </div>
                  </motion.div>
                );
              })
          ) : (
            <div className="text-xs text-white/20 italic p-3 text-center">
              {agenticFrame
                ? "Analyzing scene..."
                : "Connecting to agentic loop..."}
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
