import { motion, AnimatePresence } from "framer-motion";
import { Target, Send } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface GoalBarProps {
  goalInput: string;
  onGoalInputChange: (v: string) => void;
  activeGoal: string;
  onSetGoal: () => void;
  onPreset: (preset: string) => void;
  presets: string[];
}

export function GoalBar({ goalInput, onGoalInputChange, activeGoal, onSetGoal, onPreset, presets }: GoalBarProps) {
  return (
    <Card className="border-terminal-green/20 bg-background/80 backdrop-blur">
      <CardContent className="pt-3 pb-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <label className="text-[10px] font-mono text-terminal-green/70 uppercase tracking-wider flex items-center gap-1.5">
              <Target className="h-3 w-3" />
              Agent Goal
            </label>
            <div className="flex gap-2">
              <Input
                value={goalInput}
                onChange={(e) => onGoalInputChange(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onSetGoal()}
                placeholder="e.g. Monitor workspace for safety"
                className="font-mono text-sm border-terminal-green/20 focus-visible:ring-terminal-green/30"
              />
              <Button
                onClick={onSetGoal}
                size="sm"
                variant="outline"
                className="border-terminal-green/30 text-terminal-green hover:bg-terminal-green/10 gap-1.5"
              >
                <Send className="h-3.5 w-3.5" />
                Set
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {presets.map((preset) => (
                <button
                  key={preset}
                  onClick={() => onPreset(preset)}
                  className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors ${
                    activeGoal === preset
                      ? "border-terminal-green bg-terminal-green/20 text-terminal-green"
                      : "border-muted-foreground/20 text-muted-foreground hover:border-terminal-green/40 hover:text-terminal-green/70"
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Active goal */}
        <AnimatePresence>
          {activeGoal && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="mt-2 flex items-center gap-2 px-3 py-1.5 rounded-md bg-terminal-green/10 border border-terminal-green/20"
            >
              <Target className="h-3.5 w-3.5 text-terminal-green shrink-0" />
              <span className="font-mono text-[10px] text-terminal-green">ACTIVE GOAL:</span>
              <span className="font-mono text-xs text-foreground truncate">{activeGoal}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
