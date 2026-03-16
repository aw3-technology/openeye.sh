import { useState, useEffect, useCallback, useRef } from "react";
import { useOpenEyeConnection } from "@/hooks/useOpenEyeConnection";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, RefreshCw, RotateCcw, Settings2 } from "lucide-react";
import { toast } from "sonner";
import type { RuntimeConfig } from "@/types/openeye";
import { vlmModelOptions, cortexLlmOptions } from "@/data/modelOptions";
import { RuntimeConfigPanel } from "@/components/dashboard/config-editor/RuntimeConfigPanel";
import { SystemPromptsPanel } from "@/components/dashboard/config-editor/SystemPromptsPanel";
import { RawJsonPanel } from "@/components/dashboard/config-editor/RawJsonPanel";

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

  const addPrompt = (key: string) => {
    if (systemPrompts.some((p) => p.key === key)) {
      toast.error(`Prompt key "${key}" already exists`);
      return;
    }
    setSystemPrompts((prev) => [...prev, { key, value: "" }]);
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

  const saveButton = (
    <div className="flex items-center gap-3">
      <Button onClick={saveForm} disabled={saving} className="gap-2">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Save Configuration
      </Button>
      <span className="text-xs text-muted-foreground">Changes are hot-reloaded on the server.</span>
    </div>
  );

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

        <TabsContent value="form" className="mt-4 space-y-4">
          <RuntimeConfigPanel
            modes={modes}
            onModesChange={setModes}
            vlmModel={vlmModel}
            onVlmModelChange={setVlmModel}
            cortexLlm={cortexLlm}
            onCortexLlmChange={setCortexLlm}
            hertz={hertz}
            onHertzChange={setHertz}
            confidenceThreshold={confidenceThreshold}
            onConfidenceThresholdChange={setConfidenceThreshold}
            dangerM={dangerM}
            onDangerMChange={setDangerM}
            cautionM={cautionM}
            onCautionMChange={setCautionM}
            iouThreshold={iouThreshold}
            onIouThresholdChange={setIouThreshold}
            lightingRobustness={lightingRobustness}
            onLightingRobustnessChange={setLightingRobustness}
            onResetDefaults={resetToDefaults}
            vlmModelOptions={vlmModelOptions}
            cortexLlmOptions={cortexLlmOptions}
          />
          {saveButton}
        </TabsContent>

        <TabsContent value="prompts" className="mt-4 space-y-4">
          <SystemPromptsPanel
            prompts={systemPrompts}
            onAddPrompt={addPrompt}
            onRemovePrompt={removePrompt}
            onUpdatePromptValue={updatePromptValue}
          />
          {saveButton}
        </TabsContent>

        <TabsContent value="raw" className="mt-4 space-y-4">
          <RawJsonPanel
            rawText={rawText}
            onRawTextChange={setRawText}
            onSave={saveRaw}
            saving={saving}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
