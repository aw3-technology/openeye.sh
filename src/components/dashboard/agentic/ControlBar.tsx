import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Brain,
  Target,
  Loader2,
  Send,
  RotateCcw,
  Wifi,
  WifiOff,
} from "lucide-react";
import { PRESET_GOALS } from "./utils";
import type { AgenticLoopState } from "./useAgenticLoop";

type ControlBarProps = Pick<
  AgenticLoopState,
  | "connected"
  | "running"
  | "goal"
  | "goalInput"
  | "setGoalInput"
  | "handleSetGoal"
  | "setPresetGoal"
  | "startAgent"
  | "stopLoop"
  | "isStreaming"
>;

export function ControlBar({
  connected,
  running,
  goal,
  goalInput,
  setGoalInput,
  handleSetGoal,
  setPresetGoal,
  startAgent,
  stopLoop,
  isStreaming,
}: ControlBarProps) {
  return (
    <Card className="border-terminal-green/20 bg-background/80 backdrop-blur">
      <CardContent className="pt-4 pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          {/* Goal input */}
          <div className="flex-1 space-y-1.5">
            <label className="text-xs font-mono text-terminal-green/70 uppercase tracking-wider flex items-center gap-1.5">
              <Target className="h-3 w-3" />
              Agent Goal
            </label>
            <div className="flex gap-2">
              <Input
                value={goalInput}
                onChange={(e) => setGoalInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSetGoal()}
                placeholder="e.g. Pick up the red cup"
                className="font-mono text-sm border-terminal-green/20 focus-visible:ring-terminal-green/30"
              />
              <Button
                onClick={handleSetGoal}
                size="sm"
                variant="outline"
                className="border-terminal-green/30 text-terminal-green hover:bg-terminal-green/10 gap-1.5"
              >
                <Send className="h-3.5 w-3.5" />
                Set
              </Button>
            </div>
            {/* Preset quick-select */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {PRESET_GOALS.map((preset) => (
                <button
                  key={preset}
                  onClick={() => setPresetGoal(preset)}
                  className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors ${
                    goal === preset
                      ? "border-terminal-green bg-terminal-green/20 text-terminal-green"
                      : "border-muted-foreground/20 text-muted-foreground hover:border-terminal-green/40 hover:text-terminal-green/70"
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Action buttons + connection status */}
          <div className="flex items-center gap-3">
            {/* Connection indicator */}
            <div className="flex items-center gap-1.5 text-[10px] font-mono">
              {connected ? (
                <>
                  <Wifi className="h-3 w-3 text-terminal-green" />
                  <span className="text-terminal-green">Connected</span>
                </>
              ) : running ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin text-terminal-amber" />
                  <span className="text-terminal-amber">Connecting...</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">Idle</span>
                </>
              )}
            </div>

            {!running ? (
              <Button
                onClick={startAgent}
                disabled={!isStreaming}
                className="gap-2 bg-terminal-green hover:bg-terminal-green/80 text-primary-foreground"
              >
                <Brain className="h-4 w-4" />
                Start Agent
              </Button>
            ) : (
              <Button
                onClick={stopLoop}
                variant="destructive"
                className="gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Stop
              </Button>
            )}
          </div>
        </div>

        {/* Active goal display */}
        {goal && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 flex items-center gap-2 px-3 py-1.5 rounded-md bg-terminal-green/10 border border-terminal-green/20"
          >
            <Target className="h-3.5 w-3.5 text-terminal-green" />
            <span className="font-mono text-xs text-terminal-green">
              ACTIVE GOAL:
            </span>
            <span className="font-mono text-xs text-foreground">{goal}</span>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}
