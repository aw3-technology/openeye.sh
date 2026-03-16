import { Card, CardContent } from "@/components/ui/card";
import {
  Activity,
  Brain,
  Clock,
  Eye,
  Layers,
  Zap,
} from "lucide-react";
import { colorStyles } from "./utils";
import type { AgenticLoopState } from "./useAgenticLoop";

function StatusCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  const styles = colorStyles[color] ?? colorStyles["terminal-green"];
  return (
    <Card className={styles.border}>
      <CardContent className="pt-3 pb-2 px-3">
        <div className="flex items-center gap-2">
          <div className={styles.text}>{icon}</div>
          <div>
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
              {label}
            </p>
            <p className={`text-lg font-semibold font-mono tabular-nums ${styles.text}`}>
              {value}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

type StatusHudProps = Pick<
  AgenticLoopState,
  "running" | "fps" | "latestFrame" | "detectionCount" | "totalFrames" | "hasSafetyAlerts"
>;

export function StatusHud({
  running,
  fps,
  latestFrame,
  detectionCount,
  totalFrames,
  hasSafetyAlerts,
}: StatusHudProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      <StatusCard
        icon={<Activity className="h-4 w-4" />}
        label="FPS"
        value={running ? `${fps}` : "--"}
        color="terminal-green"
      />
      <StatusCard
        icon={<Zap className="h-4 w-4" />}
        label="Detection"
        value={latestFrame ? `${latestFrame.latency.detection_ms.toFixed(0)}ms` : "--"}
        color={
          latestFrame && latestFrame.latency.detection_ms < 100
            ? "terminal-green"
            : "terminal-amber"
        }
      />
      <StatusCard
        icon={<Brain className="h-4 w-4" />}
        label="VLM"
        value={latestFrame?.latency.vlm_ms ? `${latestFrame.latency.vlm_ms.toFixed(0)}ms` : "idle"}
        color="terminal-amber"
      />
      <StatusCard
        icon={<Eye className="h-4 w-4" />}
        label="Objects"
        value={running ? `${detectionCount}` : "--"}
        color={hasSafetyAlerts ? "terminal-red" : "terminal-green"}
      />
      <StatusCard
        icon={<Layers className="h-4 w-4" />}
        label="Frames"
        value={running ? `${totalFrames}` : "--"}
        color="terminal-green"
      />
      <StatusCard
        icon={<Clock className="h-4 w-4" />}
        label="Total"
        value={latestFrame ? `${latestFrame.latency.total_ms.toFixed(0)}ms` : "--"}
        color={
          latestFrame && latestFrame.latency.total_ms < 200
            ? "terminal-green"
            : latestFrame && latestFrame.latency.total_ms < 500
            ? "terminal-amber"
            : "terminal-red"
        }
      />
    </div>
  );
}
