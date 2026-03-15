import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AppWindow,
  MousePointerClick,
  Type,
  Layout,
  Clock,
  Gauge,
} from "lucide-react";
import type { DesktopPerceptionResult, UIElement } from "@/types/openeye";

interface DesktopAnalysisProps {
  result: DesktopPerceptionResult | null;
  fps: number;
  frameCount: number;
}

const TYPE_BADGE_VARIANT: Record<string, string> = {
  button: "bg-green-500/20 text-green-400 border-green-500/30",
  input: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  link: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  menu: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  tab: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  dialog: "bg-red-500/20 text-red-400 border-red-500/30",
};

function ElementBadge({ el }: { el: UIElement }) {
  const cls =
    TYPE_BADGE_VARIANT[el.type] ||
    "bg-muted text-muted-foreground border-border";
  return (
    <div className="flex items-center gap-2 py-1">
      <Badge variant="outline" className={`text-[10px] font-mono ${cls}`}>
        {el.type}
      </Badge>
      <span className="text-xs truncate flex-1">
        {el.text || <span className="text-muted-foreground italic">no text</span>}
      </span>
      {el.state !== "enabled" && (
        <Badge variant="outline" className="text-[9px] font-mono">
          {el.state}
        </Badge>
      )}
      <span className="text-[10px] text-muted-foreground font-mono">
        {(el.confidence * 100).toFixed(0)}%
      </span>
    </div>
  );
}

export function DesktopAnalysis({
  result,
  fps,
  frameCount,
}: DesktopAnalysisProps) {
  if (!result) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            Start screen share to see desktop analysis
          </CardContent>
        </Card>
      </div>
    );
  }

  const { active_window, ui_elements, text_regions, focused_element, layout_description, latency } =
    result;

  return (
    <div className="space-y-3">
      {/* Latency HUD */}
      <div className="grid grid-cols-4 gap-2">
        <LatencyCard
          icon={<Gauge className="h-3 w-3" />}
          label="FPS"
          value={`${fps}`}
        />
        <LatencyCard
          icon={<Clock className="h-3 w-3" />}
          label="Detect"
          value={`${latency.detection_ms.toFixed(0)}ms`}
          color={latency.detection_ms < 100 ? "green" : latency.detection_ms < 300 ? "amber" : "red"}
        />
        <LatencyCard
          icon={<Clock className="h-3 w-3" />}
          label="VLM"
          value={`${latency.vlm_ms.toFixed(0)}ms`}
          color={latency.vlm_ms < 3000 ? "green" : latency.vlm_ms < 5000 ? "amber" : "red"}
        />
        <LatencyCard
          icon={<Clock className="h-3 w-3" />}
          label="Total"
          value={`${latency.total_ms.toFixed(0)}ms`}
        />
      </div>

      {/* Active Window */}
      <Card>
        <CardHeader className="py-2 px-3">
          <CardTitle className="text-xs font-mono flex items-center gap-1.5">
            <AppWindow className="h-3 w-3 text-terminal-green" />
            Active Window
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-2">
          <p className="text-sm font-medium truncate">
            {active_window.title || "Unknown"}
          </p>
          <p className="text-xs text-muted-foreground">
            {active_window.application || "Unknown app"}
          </p>
        </CardContent>
      </Card>

      {/* UI Elements */}
      <Card>
        <CardHeader className="py-2 px-3">
          <CardTitle className="text-xs font-mono flex items-center gap-1.5">
            <MousePointerClick className="h-3 w-3 text-terminal-green" />
            UI Elements
            <Badge variant="outline" className="text-[10px] ml-auto">
              {ui_elements.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-2">
          <ScrollArea className="max-h-48">
            <div className="divide-y divide-border">
              {ui_elements.length > 0 ? (
                ui_elements.map((el, i) => (
                  <ElementBadge key={i} el={el} />
                ))
              ) : (
                <p className="text-xs text-muted-foreground py-2">
                  No UI elements detected
                </p>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Text Regions */}
      {text_regions.length > 0 && (
        <Card>
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-xs font-mono flex items-center gap-1.5">
              <Type className="h-3 w-3 text-terminal-green" />
              Text Regions
              <Badge variant="outline" className="text-[10px] ml-auto">
                {text_regions.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-2">
            <ScrollArea className="max-h-36">
              <div className="space-y-2">
                {text_regions.map((region, i) => (
                  <div key={i}>
                    <p className="text-[10px] text-muted-foreground font-mono">
                      {region.region_name}
                    </p>
                    <p className="text-xs truncate">{region.text}</p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Layout Description */}
      {layout_description && (
        <Card>
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-xs font-mono flex items-center gap-1.5">
              <Layout className="h-3 w-3 text-terminal-green" />
              Layout
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-2">
            <p className="text-xs text-muted-foreground">{layout_description}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function LatencyCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color?: "green" | "amber" | "red";
}) {
  const colorCls =
    color === "green"
      ? "text-terminal-green"
      : color === "amber"
        ? "text-terminal-amber"
        : color === "red"
          ? "text-red-400"
          : "text-foreground";

  return (
    <div className="rounded-md border border-border bg-muted/30 px-2 py-1.5 text-center">
      <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">
        {icon}
        <span className="text-[9px] font-mono uppercase">{label}</span>
      </div>
      <p className={`text-sm font-mono font-bold ${colorCls}`}>{value}</p>
    </div>
  );
}
