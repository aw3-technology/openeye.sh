import { useState } from "react";
import { useOpenEyeStream } from "@/hooks/useOpenEyeStream";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Settings2, ChevronDown } from "lucide-react";

export function ModelSettingsPanel() {
  const { modelParams, setModelParams } = useOpenEyeStream();
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="border-foreground/10 bg-card/50 backdrop-blur-sm">
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-2 cursor-pointer hover:bg-foreground/5 transition-colors rounded-t-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings2 className="h-3.5 w-3.5 text-terminal-amber" />
                <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider">
                  Model Settings
                </CardTitle>
              </div>
              <ChevronDown
                className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${
                  open ? "rotate-180" : ""
                }`}
              />
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            {/* Confidence Threshold */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] text-muted-foreground">
                  Confidence
                </span>
                <span className="font-mono text-[11px] tabular-nums text-terminal-green">
                  {(modelParams.confidence_threshold * 100).toFixed(0)}%
                </span>
              </div>
              <Slider
                value={[modelParams.confidence_threshold]}
                min={0.1}
                max={0.95}
                step={0.05}
                onValueChange={([v]) =>
                  setModelParams({ ...modelParams, confidence_threshold: v })
                }
              />
            </div>

            {/* NMS Threshold */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] text-muted-foreground">
                  NMS Threshold
                </span>
                <span className="font-mono text-[11px] tabular-nums text-terminal-green">
                  {(modelParams.nms_threshold * 100).toFixed(0)}%
                </span>
              </div>
              <Slider
                value={[modelParams.nms_threshold]}
                min={0.1}
                max={0.9}
                step={0.05}
                onValueChange={([v]) =>
                  setModelParams({ ...modelParams, nms_threshold: v })
                }
              />
            </div>

            {/* Max Detections */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] text-muted-foreground">
                  Max Detections
                </span>
                <span className="font-mono text-[11px] tabular-nums text-terminal-green">
                  {modelParams.max_detections}
                </span>
              </div>
              <Slider
                value={[modelParams.max_detections]}
                min={10}
                max={300}
                step={10}
                onValueChange={([v]) =>
                  setModelParams({ ...modelParams, max_detections: v })
                }
              />
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
