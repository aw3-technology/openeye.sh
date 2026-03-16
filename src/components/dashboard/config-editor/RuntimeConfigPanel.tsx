import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Settings2, ShieldAlert } from "lucide-react";
import type { ModelOption } from "@/data/modelOptions";

const NONE_VALUE = "__none__";

function groupByProvider(models: ModelOption[]): Record<string, ModelOption[]> {
  const grouped: Record<string, ModelOption[]> = {};
  for (const m of models) {
    (grouped[m.provider] ??= []).push(m);
  }
  return grouped;
}

interface RuntimeConfigPanelProps {
  modes: string;
  onModesChange: (v: string) => void;
  vlmModel: string;
  onVlmModelChange: (v: string) => void;
  cortexLlm: string;
  onCortexLlmChange: (v: string) => void;
  hertz: number;
  onHertzChange: (v: number) => void;
  confidenceThreshold: number;
  onConfidenceThresholdChange: (v: number) => void;
  dangerM: number;
  onDangerMChange: (v: number) => void;
  cautionM: number;
  onCautionMChange: (v: number) => void;
  iouThreshold: number;
  onIouThresholdChange: (v: number) => void;
  lightingRobustness: boolean;
  onLightingRobustnessChange: (v: boolean) => void;
  onResetDefaults: () => void;
  vlmModelOptions: ModelOption[];
  cortexLlmOptions: ModelOption[];
}

export function RuntimeConfigPanel({
  modes,
  onModesChange,
  vlmModel,
  onVlmModelChange,
  cortexLlm,
  onCortexLlmChange,
  hertz,
  onHertzChange,
  confidenceThreshold,
  onConfidenceThresholdChange,
  dangerM,
  onDangerMChange,
  cautionM,
  onCautionMChange,
  iouThreshold,
  onIouThresholdChange,
  lightingRobustness,
  onLightingRobustnessChange,
  onResetDefaults,
  vlmModelOptions,
  cortexLlmOptions,
}: RuntimeConfigPanelProps) {
  const vlmByProvider = groupByProvider(vlmModelOptions);
  const cortexByProvider = groupByProvider(cortexLlmOptions);

  return (
    <div className="space-y-4">
      {/* Core Runtime Config */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Runtime Configuration</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="modes">Modes (comma-separated)</Label>
            <Input
              id="modes"
              value={modes}
              onChange={(e) => onModesChange(e.target.value)}
              placeholder="e.g. detect, segment, depth"
            />
            <p className="text-xs text-muted-foreground">
              Perception pipeline modes. Common values: detect, segment, depth, vla.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>VLM Model</Label>
              <Select value={vlmModel || NONE_VALUE} onValueChange={(v) => onVlmModelChange(v === NONE_VALUE ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select VLM model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>
                    <span className="text-muted-foreground">Default (env)</span>
                  </SelectItem>
                  {Object.entries(vlmByProvider).map(([provider, models]) => (
                    <SelectGroup key={provider}>
                      <SelectLabel>{provider}</SelectLabel>
                      {models.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.label}
                          {m.free && <span className="ml-1.5 text-xs text-terminal-green">free</span>}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Vision-language model for perception.</p>
            </div>

            <div className="space-y-2">
              <Label>Cortex LLM</Label>
              <Select
                value={cortexLlm || NONE_VALUE}
                onValueChange={(v) => onCortexLlmChange(v === NONE_VALUE ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select cortex LLM" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>
                    <span className="text-muted-foreground">Default (env)</span>
                  </SelectItem>
                  {Object.entries(cortexByProvider).map(([provider, models]) => (
                    <SelectGroup key={provider}>
                      <SelectLabel>{provider}</SelectLabel>
                      {models.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.label}
                          {m.free && <span className="ml-1.5 text-xs text-terminal-green">free</span>}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Reasoning model for the cortex planning layer.</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Stream Hz</Label>
              <span className="text-sm font-mono tabular-nums text-muted-foreground">{hertz} fps</span>
            </div>
            <Slider
              value={[hertz]}
              onValueChange={([v]) => onHertzChange(v)}
              min={1}
              max={60}
              step={1}
            />
            <p className="text-xs text-muted-foreground">
              Frame processing rate. Higher values use more compute.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Safety & Detection */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-terminal-amber" />
              <CardTitle className="text-base">Safety & Detection</CardTitle>
            </div>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onResetDefaults}>
              Reset Defaults
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Confidence Threshold</Label>
              <span className="text-sm font-mono tabular-nums text-muted-foreground">
                {confidenceThreshold.toFixed(2)}
              </span>
            </div>
            <Slider
              value={[confidenceThreshold]}
              onValueChange={([v]) => onConfidenceThresholdChange(v)}
              min={0.05}
              max={0.95}
              step={0.05}
            />
            <p className="text-xs text-muted-foreground">
              Minimum detection confidence. Lower = more detections, higher = fewer false positives.
            </p>
          </div>

          <Separator />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>
                  <span className="text-red-400">Danger</span> Zone (m)
                </Label>
                <span className="text-sm font-mono tabular-nums text-red-400">{dangerM.toFixed(1)}m</span>
              </div>
              <Slider
                value={[dangerM]}
                onValueChange={([v]) => onDangerMChange(v)}
                min={0.1}
                max={2.0}
                step={0.1}
              />
              <p className="text-xs text-muted-foreground">Distance for HALT recommendation.</p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>
                  <span className="text-terminal-amber">Caution</span> Zone (m)
                </Label>
                <span className="text-sm font-mono tabular-nums text-terminal-amber">{cautionM.toFixed(1)}m</span>
              </div>
              <Slider
                value={[cautionM]}
                onValueChange={([v]) => onCautionMChange(v)}
                min={0.5}
                max={5.0}
                step={0.1}
              />
              <p className="text-xs text-muted-foreground">Distance for slow-down alerts.</p>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>IoU Threshold (Tracking)</Label>
              <span className="text-sm font-mono tabular-nums text-muted-foreground">
                {iouThreshold.toFixed(2)}
              </span>
            </div>
            <Slider
              value={[iouThreshold]}
              onValueChange={([v]) => onIouThresholdChange(v)}
              min={0.1}
              max={0.9}
              step={0.05}
            />
            <p className="text-xs text-muted-foreground">
              Intersection-over-union threshold for object tracking across frames.
            </p>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label>Lighting Robustness</Label>
              <p className="text-xs text-muted-foreground">
                Enable adaptive preprocessing for variable lighting conditions.
              </p>
            </div>
            <Switch checked={lightingRobustness} onCheckedChange={onLightingRobustnessChange} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
