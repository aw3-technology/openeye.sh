import type { Dispatch, SetStateAction } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Thermometer, Layers, Info } from "lucide-react";
import { toast } from "sonner";
import { vlmModelOptions, cortexLlmOptions } from "@/data/modelOptions";
import type { ModelParameters } from "@/types/openeye";
import type { VlmParams, InferenceParams, StreamParams } from "./types";
import { DETECTION_MODELS } from "./types";
import { PresetButton, ConfigSummaryItem } from "./shared";

export function VlmTab({
  vlm,
  setVlm,
  activeDetector,
  detection,
  inference,
  stream,
}: {
  vlm: VlmParams;
  setVlm: Dispatch<SetStateAction<VlmParams>>;
  activeDetector: string;
  detection: ModelParameters;
  inference: InferenceParams;
  stream: StreamParams;
}) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Thermometer className="h-4 w-4 text-terminal-amber" />
            VLM Generation Parameters
          </CardTitle>
          <CardDescription>
            Control how the vision-language model generates responses.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Temperature */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Temperature</Label>
              <span className="text-sm font-mono tabular-nums">
                {vlm.temperature.toFixed(2)}
              </span>
            </div>
            <Slider
              value={[vlm.temperature]}
              onValueChange={([v]) =>
                setVlm((prev) => ({ ...prev, temperature: v }))
              }
              min={0}
              max={2}
              step={0.05}
            />
            <p className="text-xs text-muted-foreground">
              Controls randomness. Lower values make output more
              deterministic; higher values increase creativity.
            </p>
          </div>

          {/* Top P */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Top P (Nucleus Sampling)</Label>
              <span className="text-sm font-mono tabular-nums">
                {vlm.top_p.toFixed(2)}
              </span>
            </div>
            <Slider
              value={[vlm.top_p]}
              onValueChange={([v]) =>
                setVlm((prev) => ({ ...prev, top_p: v }))
              }
              min={0}
              max={1}
              step={0.05}
            />
            <p className="text-xs text-muted-foreground">
              Cumulative probability threshold for token sampling. Lower
              values restrict to more likely tokens.
            </p>
          </div>

          {/* Max tokens */}
          <div className="space-y-2">
            <Label htmlFor="max-tokens">Max Tokens</Label>
            <Input
              id="max-tokens"
              type="number"
              value={vlm.max_tokens}
              onChange={(e) =>
                setVlm((prev) => ({
                  ...prev,
                  max_tokens: Math.max(
                    32,
                    Math.min(4096, Math.floor(Number(e.target.value) || 512)),
                  ),
                }))
              }
              min={32}
              max={4096}
              className="max-w-[200px]"
            />
            <p className="text-xs text-muted-foreground">
              Maximum tokens in the VLM response (32–4096). Longer responses
              take more time and credits.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* VLM Presets */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="h-4 w-4" />
            VLM Presets
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            <PresetButton
              label="Safety Critical"
              description="Deterministic, concise — for safety reasoning"
              onClick={() => {
                setVlm((prev) => ({
                  ...prev,
                  temperature: 0.1,
                  top_p: 0.5,
                  max_tokens: 256,
                }));
                toast.success("Applied Safety Critical preset");
              }}
            />
            <PresetButton
              label="Balanced"
              description="Good balance for general scene description"
              onClick={() => {
                setVlm((prev) => ({
                  ...prev,
                  temperature: 0.7,
                  top_p: 0.9,
                  max_tokens: 512,
                }));
                toast.success("Applied Balanced preset");
              }}
            />
            <PresetButton
              label="Detailed Analysis"
              description="Thorough, creative — for deep scene analysis"
              onClick={() => {
                setVlm((prev) => ({
                  ...prev,
                  temperature: 1.0,
                  top_p: 0.95,
                  max_tokens: 2048,
                }));
                toast.success("Applied Detailed Analysis preset");
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Current config summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="h-4 w-4" />
            Current Configuration Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <ConfigSummaryItem
              label="Detection Model"
              value={
                DETECTION_MODELS.find((m) => m.id === activeDetector)
                  ?.label || activeDetector
              }
            />
            <ConfigSummaryItem
              label="VLM Model"
              value={
                vlm.vlm_model
                  ? vlmModelOptions.find((m) => m.id === vlm.vlm_model)
                      ?.label || vlm.vlm_model
                  : "Default (env)"
              }
            />
            <ConfigSummaryItem
              label="Cortex LLM"
              value={
                vlm.cortex_llm
                  ? cortexLlmOptions.find((m) => m.id === vlm.cortex_llm)
                      ?.label || vlm.cortex_llm
                  : "Default (env)"
              }
            />
            <ConfigSummaryItem
              label="Device"
              value={inference.device.toUpperCase()}
            />
            <ConfigSummaryItem
              label="Precision"
              value={inference.precision.toUpperCase()}
            />
            <ConfigSummaryItem
              label="Confidence"
              value={detection.confidence_threshold.toFixed(2)}
            />
            <ConfigSummaryItem
              label="Stream Rate"
              value={`${stream.hertz} Hz`}
            />
            <ConfigSummaryItem
              label="VLM Temperature"
              value={vlm.temperature.toFixed(2)}
            />
          </div>
        </CardContent>
      </Card>
    </>
  );
}
