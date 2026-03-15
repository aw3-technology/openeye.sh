import { useState, useEffect } from "react";
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
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import type { RuntimeConfig } from "@/types/openeye";
import { vlmModelOptions, cortexLlmOptions } from "@/data/modelOptions";

const NONE_VALUE = "__none__";

export default function ConfigEditor() {
  const { client, isConnected } = useOpenEyeConnection();
  const [config, setConfig] = useState<RuntimeConfig | null>(null);
  const [rawText, setRawText] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [modes, setModes] = useState("");
  const [cortexLlm, setCortexLlm] = useState("");
  const [vlmModel, setVlmModel] = useState("");
  const [hertz, setHertz] = useState(10);

  useEffect(() => {
    if (!isConnected) return;
    setLoading(true);
    client
      .getConfig()
      .then((cfg) => {
        setConfig(cfg);
        setRawText(JSON.stringify(cfg, null, 2));
        setModes((cfg.modes || []).join(", "));
        setCortexLlm(cfg.cortex_llm || "");
        setVlmModel(cfg.vlm_model || "");
        setHertz(typeof cfg.hertz === "number" ? cfg.hertz : 10);
      })
      .catch(() => {
        toast.error("Failed to load config");
      })
      .finally(() => setLoading(false));
  }, [client, isConnected]);

  const saveForm = async () => {
    setSaving(true);
    try {
      const updated: RuntimeConfig = {
        ...config,
        modes: modes
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        cortex_llm: cortexLlm || undefined,
        vlm_model: vlmModel || undefined,
        hertz,
      };
      await client.putConfig(updated);
      setConfig(updated);
      setRawText(JSON.stringify(updated, null, 2));
      toast.success("Config saved");
    } catch (err) {
      console.error("[ConfigEditor] Failed to save config:", err);
      toast.error(`Failed to save config: ${err instanceof Error ? err.message : "unknown error"}`);
    } finally {
      setSaving(false);
    }
  };

  const saveRaw = async () => {
    setSaving(true);
    try {
      const parsed = JSON.parse(rawText);
      // Validate RuntimeConfig shape
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
      await client.putConfig(parsed);
      setConfig(parsed);
      setModes((parsed.modes || []).join(", "));
      setCortexLlm(parsed.cortex_llm || "");
      setVlmModel(parsed.vlm_model || "");
      setHertz(typeof parsed.hertz === "number" ? parsed.hertz : 10);
      toast.success("Config saved");
    } catch (e) {
      console.error("[ConfigEditor] Failed to save raw config:", e);
      toast.error(e instanceof SyntaxError ? "Invalid JSON" : `Failed to save config: ${e instanceof Error ? e.message : "unknown error"}`);
    } finally {
      setSaving(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Config Editor</h1>
        <p className="text-sm text-muted-foreground">
          Connect to an OpenEye server to edit its configuration.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Group model options by provider
  const vlmByProvider = Object.groupBy(vlmModelOptions, (m) => m.provider);
  const cortexByProvider = Object.groupBy(cortexLlmOptions, (m) => m.provider);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Config Editor</h1>

      <Tabs defaultValue="form">
        <TabsList>
          <TabsTrigger value="form">Form</TabsTrigger>
          <TabsTrigger value="raw">Raw JSON</TabsTrigger>
        </TabsList>

        <TabsContent value="form" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Runtime Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="modes">Modes (comma-separated)</Label>
                <Input
                  id="modes"
                  value={modes}
                  onChange={(e) => setModes(e.target.value)}
                  placeholder="e.g. detect, segment"
                />
              </div>

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
                        {models!.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.label}
                            {m.free && <span className="ml-1.5 text-xs text-terminal-green">free</span>}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Vision-language model for perception. Overrides NEBIUS_MODEL env var.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Cortex LLM</Label>
                <Select value={cortexLlm || NONE_VALUE} onValueChange={(v) => setCortexLlm(v === NONE_VALUE ? "" : v)}>
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
                        {models!.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.label}
                            {m.free && <span className="ml-1.5 text-xs text-terminal-green">free</span>}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Reasoning model for the cortex planning layer.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="hertz">Stream Hz</Label>
                <Input
                  id="hertz"
                  type="number"
                  value={hertz}
                  onChange={(e) => setHertz(Number(e.target.value) || 10)}
                  min={1}
                  max={60}
                />
              </div>

              <Button onClick={saveForm} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="raw" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Raw Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                className="min-h-[300px] font-mono text-xs"
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
