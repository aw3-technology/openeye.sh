import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Play, Square, Target, Send, Activity, Eye, Brain, Zap, Wifi, WifiOff } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAgentStream } from "@/hooks/useAgentStream";
import { useOpenEyeConnection } from "@/hooks/useOpenEyeConnection";
import { ScenePanel } from "@/components/dashboard/agent/ScenePanel";
import { ReasoningLog } from "@/components/dashboard/agent/ReasoningLog";
import { PlanPanel } from "@/components/dashboard/agent/PlanPanel";

const PRESET_GOALS = [
  "Monitor workspace for safety",
  "Track all people",
  "Identify hazards",
  "Describe the scene",
];

export default function AgentLoop() {
  const { serverUrl, isConnected } = useOpenEyeConnection();
  const { ticks, currentTick, plan, isRunning, memories, startAgent, stopAgent, mode } =
    useAgentStream(serverUrl);

  const [goalInput, setGoalInput] = useState("");
  const [activeGoal, setActiveGoal] = useState("Monitor workspace for safety");

  const detections = currentTick?.observation?.detections ?? [];
  const sceneSummary = currentTick?.observation?.scene_summary ?? "";
  const tickNumber = currentTick?.tick ?? 0;
  const planChanged = currentTick?.reasoning?.plan_changed ?? false;
  const chainOfThought = currentTick?.reasoning?.chain_of_thought ?? "";
  const actionTaken = currentTick?.action_taken ?? "";
  const phase = currentTick?.phase ?? "idle";

  const handleSetGoal = () => {
    const g = goalInput.trim();
    if (!g) return;
    setActiveGoal(g);
  };

  const handlePreset = (preset: string) => {
    setGoalInput(preset);
    setActiveGoal(preset);
  };

  const phaseColor =
    phase === "perceive"
      ? "text-terminal-green"
      : phase === "recall"
        ? "text-blue-400"
        : phase === "reason"
          ? "text-terminal-amber"
          : phase === "act"
            ? "text-orange-400"
            : "text-muted-foreground";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bot className="h-6 w-6 text-terminal-green" />
          <h1 className="text-2xl font-semibold">Agent Loop</h1>
          <Badge
            variant="outline"
            className="text-[10px] font-mono uppercase tracking-wider border-terminal-green/30 text-terminal-green"
          >
            Perceive &rarr; Recall &rarr; Reason &rarr; Act
          </Badge>
          {isRunning && (
            <span className="flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 bg-terminal-green/15 text-terminal-green border border-terminal-green/30 rounded">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-terminal-green opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-terminal-green" />
              </span>
              {mode === "demo" ? "DEMO" : "LIVE"}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Connection indicator */}
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground">
            {isConnected ? (
              <Wifi className="h-3 w-3 text-terminal-green" />
            ) : (
              <WifiOff className="h-3 w-3 text-muted-foreground" />
            )}
            {isConnected ? "Connected" : "Offline"}
          </div>

          {isRunning ? (
            <Button
              onClick={stopAgent}
              variant="destructive"
              size="sm"
              className="gap-2 font-mono"
            >
              <Square className="h-3.5 w-3.5" />
              Stop
            </Button>
          ) : (
            <div className="flex gap-1.5">
              <Button
                onClick={() => startAgent("demo")}
                size="sm"
                className="gap-2 font-mono bg-terminal-green hover:bg-terminal-green/80 text-primary-foreground"
              >
                <Play className="h-3.5 w-3.5" />
                Demo
              </Button>
              <Button
                onClick={() => startAgent("live")}
                size="sm"
                variant="outline"
                disabled={!isConnected}
                className="gap-2 font-mono border-terminal-green/30 text-terminal-green hover:bg-terminal-green/10"
              >
                <Zap className="h-3.5 w-3.5" />
                Live
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Goal Bar */}
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
                  onChange={(e) => setGoalInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSetGoal()}
                  placeholder="e.g. Monitor workspace for safety"
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
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {PRESET_GOALS.map((preset) => (
                  <button
                    key={preset}
                    onClick={() => handlePreset(preset)}
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

      {/* Stats HUD */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatCard icon={<Activity className="h-4 w-4" />} label="Tick" value={isRunning ? `${tickNumber}` : "--"} color="green" />
        <StatCard
          icon={
            <span className={`text-xs font-mono font-bold uppercase ${phaseColor}`}>
              {phase === "idle" ? "?" : phase.charAt(0).toUpperCase()}
            </span>
          }
          label="Phase"
          value={phase}
          color={phase === "perceive" ? "green" : phase === "reason" ? "amber" : phase === "act" ? "red" : "muted"}
        />
        <StatCard icon={<Eye className="h-4 w-4" />} label="Objects" value={`${detections.length}`} color="green" />
        <StatCard icon={<Brain className="h-4 w-4" />} label="Memories" value={`${memories.length}`} color="amber" />
        <StatCard icon={<Zap className="h-4 w-4" />} label="Plan Steps" value={`${plan.length}`} color={planChanged ? "red" : "green"} />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Scene View */}
        <ScenePanel
          detections={detections}
          tickNumber={tickNumber}
          sceneSummary={sceneSummary}
          isRunning={isRunning}
          phase={phase}
        />

        {/* Center: Reasoning Log */}
        <ReasoningLog
          ticks={ticks}
          currentTick={currentTick}
        />

        {/* Right: Plan + Memory */}
        <PlanPanel
          plan={plan}
          memories={memories}
          planChanged={planChanged}
          actionTaken={actionTaken}
          isRunning={isRunning}
        />
      </div>

      {/* Chain of Thought (full width, appears when reasoning) */}
      <AnimatePresence>
        {chainOfThought && isRunning && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card className={`border-terminal-amber/20 ${planChanged ? "ring-1 ring-terminal-amber/30" : ""}`}>
              <CardContent className="pt-3 pb-3">
                <div className="flex items-start gap-2">
                  <Brain className="h-4 w-4 text-terminal-amber shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-mono text-terminal-amber uppercase tracking-wider">
                        Chain of Thought
                      </span>
                      {planChanged && (
                        <Badge variant="outline" className="text-[9px] border-terminal-amber/30 text-terminal-amber">
                          PLAN CHANGED
                        </Badge>
                      )}
                    </div>
                    <motion.p
                      key={chainOfThought.slice(0, 30)}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-sm text-foreground/80 font-mono leading-relaxed"
                    >
                      {chainOfThought}
                    </motion.p>
                    {actionTaken && (
                      <div className="mt-2 flex items-center gap-2 text-xs font-mono">
                        <span className="text-terminal-green/70">ACTION:</span>
                        <span className="text-foreground/70">{actionTaken}</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Stat card helper
function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: "green" | "amber" | "red" | "muted";
}) {
  const styles = {
    green: { border: "border-terminal-green/20", text: "text-terminal-green" },
    amber: { border: "border-terminal-amber/20", text: "text-terminal-amber" },
    red: { border: "border-terminal-red/20", text: "text-terminal-red" },
    muted: { border: "border-border", text: "text-muted-foreground" },
  }[color];

  return (
    <Card className={styles.border}>
      <CardContent className="pt-3 pb-2 px-3">
        <div className="flex items-center gap-2">
          <div className={styles.text}>{icon}</div>
          <div>
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">{label}</p>
            <p className={`text-lg font-semibold font-mono tabular-nums ${styles.text}`}>{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
