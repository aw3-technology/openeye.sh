import { useState, useEffect, useCallback, useRef } from "react";
import { useOpenEyeConnection } from "@/hooks/useOpenEyeConnection";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Save,
  RefreshCw,
  RotateCcw,
  Plus,
  Trash2,
  ShieldAlert,
  Brain,
  Settings2,
  FileCode,
} from "lucide-react";
import { toast } from "sonner";
import type { RuntimeConfig } from "@/types/openeye";
import { vlmModelOptions, cortexLlmOptions } from "@/data/modelOptions";

const NONE_VALUE = "__none__";

const DEFAULTS: Required<
  Pick<
    RuntimeConfig,
    "hertz" | "confidence_threshold" | "danger_m" | "caution_m" | "iou_threshold" | "lighting_robustness"
  >
> = {
  hertz: 10,
  confidence_threshold: 0.25,
  danger_m: 0.5,
  caution_m: 1.5,
  iou_threshold: 0.3,
  lighting_robustness: true,
};

export default function ConfigEditor() {
  const { client, isConnected } = useOpenEyeConnection();
  const [serverConfig, setServerConfig] = useState<RuntimeConfig | null>(null);
  const [rawText, setRawText] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form fields — core
  const [modes, setModes] = useState("");
  const [cortexLlm, setCortexLlm] = useState("");
  const [vlmModel, setVlmModel] = useState("");
  const [hertz, setHertz] = useState(DEFAULTS.hertz);

  // Form fields — safety & detection
  const [confidenceThreshold, setConfidenceThreshold] = useState(DEFAULTS.confidence_threshold);
  const [dangerM, setDangerM] = useState(DEFAULTS.danger_m);
  const [cautionM, setCautionM] = useState(DEFAULTS.caution_m);
  const [iouThreshold, setIouThreshold] = useState(DEFAULTS.iou_threshold);
  const [lightingRobustness, setLightingRobustness] = useState(DEFAULTS.lighting_robustness);

  // Form fields — system prompts
  const [systemPrompts, setSystemPrompts] = useState<Array<{ key: string; value: string }>>([]);
  const [newPromptKey, setNewPromptKey] = useState("");

  const dirty = useRef(false);

  const populateForm = useCallback((cfg: RuntimeConfig) => {
    setModes((cfg.modes || []).join(", "));
    setCortexLlm(cfg.cortex_llm || "");
    setVlmModel(cfg.vlm_model || "");
    setHertz(typeof cfg.hertz === "number" ? cfg.hertz : DEFAULTS.hertz);
    setConfidenceThreshold(
      typeof cfg.confidence_threshold === "number" ? cfg.confidence_threshold : DEFAULTS.confidence_threshold,
    );
    setDangerM(typeof cfg.danger_m === "number" ? cfg.danger_m : DEFAULTS.danger_m);
    setCautionM(typeof cfg.caution_m === "number" ? cfg.caution_m : DEFAULTS.caution_m);
    setIouThreshold(typeof cfg.iou_threshold === "number" ? cfg.iou_threshold : DEFAULTS.iou_threshold);
    setLightingRobustness(
      typeof cfg.lighting_robustness === "boolean" ? cfg.lighting_robustness : DEFAULTS.lighting_robustness,
    );

    const prompts = cfg.system_prompts || {};
    setSystemPrompts(Object.entries(prompts).map(([key, value]) => ({ key, value })));
    dirty.current = false;
  }, []);

  const fetchConfig = useCallback(() => {
    if (!isConnected) return;
    setLoading(true);
    client
      .getConfig()
      .then((cfg) => {
        setServerConfig(cfg);
        setRawText(JSON.stringify(cfg, null, 2));
        populateForm(cfg);
      })
      .catch(() => toast.error("Failed to load config"))
      .finally(() => setLoading(false));
  }, [client, isConnected, populateForm]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  // Mark dirty on any form change
  useEffect(() => {
    dirty.current = true;
  }, [
    modes,
    cortexLlm,
    vlmModel,
    hertz,
    confidenceThreshold,
    dangerM,
    cautionM,
    iouThreshold,
    lightingRobustness,
    systemPrompts,
  ]);

  const buildConfig = (): RuntimeConfig => {
    const promptsRecord: Record<string, string> = {};
    for (const p of systemPrompts) {
      if (p.key.trim()) promptsRecord[p.key.trim()] = p.value;
    }
    return {
      ...serverConfig,
      modes: modes
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      cortex_llm: cortexLlm || undefined,
      vlm_model: vlmModel || undefined,
      hertz,
      confidence_threshold: confidenceThreshold,
      danger_m: dangerM,
      caution_m: cautionM,
      iou_threshold: iouThreshold,
      lighting_robustness: lightingRobustness,
      system_prompts: Object.keys(promptsRecord).length > 0 ? promptsRecord : undefined,
    };
  };

  const saveForm = async () => {
    setSaving(true);
    try {
      const updated = buildConfig();
      await client.putConfig(updated);
      setServerConfig(updated);
      setRawText(JSON.stringify(updated, null, 2));
      dirty.current = false;
      toast.success("Config saved — changes applied immediately");
    } catch (err) {
      console.error("[ConfigEditor] save failed:", err);
      toast.error(`Failed to save: ${err instanceof Error ? err.message : "unknown error"}`);
    } finally {
      setSaving(false);
    }
  };

  const saveRaw = async () => {
    setSaving(true);
    try {
      const parsed = JSON.parse(rawText);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        toast.error("Config must be a JSON object");
        return;
      }
      if (parsed.modes !== undefined) {
        if (!Array.isArray(parsed.modes) || !parsed.modes.every((m: unknown) => typeof m === "string")) {
          toast.error("'modes' must be an array of strings");
          return;
        }
      }
      if (parsed.hertz !== undefined && (typeof parsed.hertz !== "number" || parsed.hertz < 1 || parsed.hertz > 60)) {
        toast.error("'hertz' must be a number between 1 and 60");
        return;
      }
      if (parsed.cortex_llm !== undefined && typeof parsed.cortex_llm !== "string") {
        toast.error("'cortex_llm' must be a string");
        return;
      }
      if (parsed.vlm_model !== undefined && typeof parsed.vlm_model !== "string") {
        toast.error("'vlm_model' must be a string");
        return;
      }
      if (
        parsed.confidence_threshold !== undefined &&
        (typeof parsed.confidence_threshold !== "number" || parsed.confidence_threshold < 0 || parsed.confidence_threshold > 1)
      ) {
        toast.error("'confidence_threshold' must be between 0 and 1");
        return;
      }
      if (parsed.system_prompts !== undefined && typeof parsed.system_prompts !== "object") {
        toast.error("'system_prompts' must be a Record<string, string>");
        return;
      }
      await client.putConfig(parsed);
      setServerConfig(parsed);
      populateForm(parsed);
      dirty.current = false;
      toast.success("Config saved — changes applied immediately");
    } catch (e) {
      console.error("[ConfigEditor] raw save failed:", e);
      toast.error(
        e instanceof SyntaxError ? "Invalid JSON" : `Failed to save: ${e instanceof Error ? e.message : "unknown error"}`,
      );
    } finally {
      setSaving(false);
    }
  };

  const resetToServer = () => {
    if (serverConfig) {
      populateForm(serverConfig);
      setRawText(JSON.stringify(serverConfig, null, 2));
      toast("Reverted to last saved config");
    }
  };

  const resetToDefaults = () => {
    setConfidenceThreshold(DEFAULTS.confidence_threshold);
    setDangerM(DEFAULTS.danger_m);
    setCautionM(DEFAULTS.caution_m);
    setIouThreshold(DEFAULTS.iou_threshold);
    setLightingRobustness(DEFAULTS.lighting_robustness);
    setHertz(DEFAULTS.hertz);
    toast("Safety & detection values reset to defaults");
  };

  // System prompt helpers
  const addPrompt = () => {
    const key = newPromptKey.trim();
    if (!key) return;
    if (systemPrompts.some((p) => p.key === key)) {
      toast.error(`Prompt key "${key}" already exists`);
      return;
    }
    setSystemPrompts((prev) => [...prev, { key, value: "" }]);
    setNewPromptKey("");
  };

  const removePrompt = (idx: number) => {
    setSystemPrompts((prev) => prev.filter((_, i) => i !== idx));
  };

  const updatePromptValue = (idx: number, value: string) => {
    setSystemPrompts((prev) => prev.map((p, i) => (i === idx ? { ...p, value } : p)));
  };

  if (!isConnected) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Config Editor</h1>
        <Card>
          <CardContent className="py-8 text-center">
            <Settings2 className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Connect to an OpenEye server to edit its runtime configuration.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Loading config...</span>
      </div>
    );
  }

  // Group model options by provider
  const vlmByProvider: Record<string, typeof vlmModelOptions> = {};
  for (const m of vlmModelOptions) {
    (vlmByProvider[m.provider] ??= []).push(m);
  }
  const cortexByProvider: Record<string, typeof cortexLlmOptions> = {};
  for (const m of cortexLlmOptions) {
    (cortexByProvider[m.provider] ??= []).push(m);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">Config Editor</h1>
          <Badge variant="outline" className="text-[10px] font-mono border-terminal-green/30 text-terminal-green">
            HOT-RELOAD
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={resetToServer} title="Revert to saved">
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={fetchConfig} title="Refresh from server">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Edit runtime configuration for the connected OpenEye server. Changes are applied immediately on save.
      </p>

      <Tabs defaultValue="form">
        <TabsList>
          <TabsTrigger value="form">Form</TabsTrigger>
          <TabsTrigger value="prompts">System Prompts</TabsTrigger>
          <TabsTrigger value="raw">Raw JSON</TabsTrigger>
        </TabsList>

        {/* ─── Form Tab ─── */}
        <TabsContent value="form" className="mt-4 space-y-4">
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
                  onChange={(e) => setModes(e.target.value)}
                  placeholder="e.g. detect, segment, depth"
                />
                <p className="text-xs text-muted-foreground">
                  Perception pipeline modes. Common values: detect, segment, depth, vla.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>VLM Model</Label>
                  <Select value={vlmModel || NONE_VALUE} onValueChange={(v) => setVlmModel(v === NONE_VALUE ? "" : v)}>
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
                    onValueChange={(v) => setCortexLlm(v === NONE_VALUE ? "" : v)}
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
                  onValueChange={([v]) => setHertz(v)}
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
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={resetToDefaults}>
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
                  onValueChange={([v]) => setConfidenceThreshold(v)}
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
                    onValueChange={([v]) => setDangerM(v)}
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
                    onValueChange={([v]) => setCautionM(v)}
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
                  onValueChange={([v]) => setIouThreshold(v)}
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
                <Switch checked={lightingRobustness} onCheckedChange={setLightingRobustness} />
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex items-center gap-3">
            <Button onClick={saveForm} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Configuration
            </Button>
            <span className="text-xs text-muted-foreground">Changes are hot-reloaded on the server.</span>
          </div>
        </TabsContent>

        {/* ─── System Prompts Tab ─── */}
        <TabsContent value="prompts" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-purple-400" />
                <CardTitle className="text-base">System Prompts</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Named system prompts injected into VLM and cortex reasoning calls. Common keys: base, safety,
                governance, task.
              </p>

              {systemPrompts.length === 0 && (
                <div className="rounded-lg border border-dashed py-6 text-center">
                  <p className="text-sm text-muted-foreground">No system prompts configured.</p>
                </div>
              )}

              {systemPrompts.map((prompt, idx) => (
                <div key={idx} className="space-y-2 rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <Label className="font-mono text-xs">{prompt.key}</Label>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-red-400"
                      onClick={() => removePrompt(idx)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <Textarea
                    value={prompt.value}
                    onChange={(e) => updatePromptValue(idx, e.target.value)}
                    className="min-h-[80px] font-mono text-xs"
                    placeholder={`Enter system prompt for "${prompt.key}"...`}
                  />
                </div>
              ))}

              <Separator />

              <div className="flex items-center gap-2">
                <Input
                  value={newPromptKey}
                  onChange={(e) => setNewPromptKey(e.target.value)}
                  placeholder="Prompt key (e.g. safety)"
                  className="max-w-[200px] font-mono text-xs"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addPrompt();
                  }}
                />
                <Button variant="outline" size="sm" onClick={addPrompt} className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" />
                  Add Prompt
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center gap-3">
            <Button onClick={saveForm} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Configuration
            </Button>
          </div>
        </TabsContent>

        {/* ─── Raw JSON Tab ─── */}
        <TabsContent value="raw" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <FileCode className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">Raw Configuration</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Edit the full configuration JSON directly. Supports arbitrary keys beyond the form fields.
              </p>
              <Textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                className="min-h-[400px] font-mono text-xs"
              />
              <Button onClick={saveRaw} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
