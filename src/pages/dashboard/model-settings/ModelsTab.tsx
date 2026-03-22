import type { Dispatch, SetStateAction } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Eye, Brain, Zap, Info } from "lucide-react";
import type { VlmParams } from "./types";
import { NONE_VALUE, DETECTION_MODELS, vlmByProvider, cortexByProvider } from "./types";

export function ModelsTab({
  activeDetector,
  setActiveDetector,
  vlm,
  setVlm,
}: {
  activeDetector: string;
  setActiveDetector: (v: string) => void;
  vlm: VlmParams;
  setVlm: Dispatch<SetStateAction<VlmParams>>;
}) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Eye className="h-4 w-4 text-terminal-green" />
            Detection Model
          </CardTitle>
          <CardDescription>
            Select the primary detection backbone. Changed via CLI{" "}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">
              openeye run &lt;model&gt;
            </code>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select
            value={activeDetector}
            onValueChange={setActiveDetector}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select detection model" />
            </SelectTrigger>
            <SelectContent>
              {DETECTION_MODELS.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  <div className="flex items-center gap-2">
                    <span>{m.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {m.size}
                    </span>
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0"
                    >
                      {m.speed}
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="p-3 bg-muted/50 rounded-md border">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="text-xs text-muted-foreground space-y-1">
                <p>
                  To switch the running model, use the CLI:
                </p>
                <code className="block font-mono text-terminal-green">
                  $ openeye run {activeDetector}
                </code>
                <p>
                  This setting is for reference — the server controls the
                  active model.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="h-4 w-4 text-terminal-amber" />
            VLM Model
          </CardTitle>
          <CardDescription>
            Vision-language model for smart-layer reasoning.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Select
            value={vlm.vlm_model || NONE_VALUE}
            onValueChange={(v) =>
              setVlm((prev) => ({
                ...prev,
                vlm_model: v === NONE_VALUE ? "" : v,
              }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select VLM model" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE_VALUE}>
                <span className="text-muted-foreground">
                  Default (env)
                </span>
              </SelectItem>
              {Object.entries(vlmByProvider).map(([provider, models]) => (
                <SelectGroup key={provider}>
                  <SelectLabel>{provider}</SelectLabel>
                  {models.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.label}
                      {m.free && (
                        <span className="ml-1.5 text-xs text-terminal-green">
                          free
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Overrides the NEBIUS_MODEL / OPENROUTER_MODEL env var.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4 text-purple-400" />
            Cortex LLM
          </CardTitle>
          <CardDescription>
            Reasoning model for the cortex planning layer.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Select
            value={vlm.cortex_llm || NONE_VALUE}
            onValueChange={(v) =>
              setVlm((prev) => ({
                ...prev,
                cortex_llm: v === NONE_VALUE ? "" : v,
              }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select cortex LLM" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE_VALUE}>
                <span className="text-muted-foreground">
                  Default (env)
                </span>
              </SelectItem>
              {Object.entries(cortexByProvider).map(
                ([provider, models]) => (
                  <SelectGroup key={provider}>
                    <SelectLabel>{provider}</SelectLabel>
                    {models.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.label}
                        {m.free && (
                          <span className="ml-1.5 text-xs text-terminal-green">
                            free
                          </span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ),
              )}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Used for agentic planning, safety reasoning, and action
            generation.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
