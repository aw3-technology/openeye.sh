import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, RefreshCw, RotateCcw, Settings2 } from "lucide-react";
import { vlmModelOptions, cortexLlmOptions } from "@/data/modelOptions";
import { RuntimeConfigPanel } from "@/components/dashboard/config-editor/RuntimeConfigPanel";
import { SystemPromptsPanel } from "@/components/dashboard/config-editor/SystemPromptsPanel";
import { RawJsonPanel } from "@/components/dashboard/config-editor/RawJsonPanel";
import { useConfigEditor } from "@/hooks/useConfigEditor";

export default function ConfigEditor() {
  const {
    isConnected,
    loading,
    saving,
    modes,
    setModes,
    cortexLlm,
    setCortexLlm,
    vlmModel,
    setVlmModel,
    hertz,
    setHertz,
    confidenceThreshold,
    setConfidenceThreshold,
    dangerM,
    setDangerM,
    cautionM,
    setCautionM,
    iouThreshold,
    setIouThreshold,
    lightingRobustness,
    setLightingRobustness,
    systemPrompts,
    rawText,
    setRawText,
    saveForm,
    saveRaw,
    resetToServer,
    resetToDefaults,
    fetchConfig,
    addPrompt,
    removePrompt,
    updatePromptValue,
  } = useConfigEditor();

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
