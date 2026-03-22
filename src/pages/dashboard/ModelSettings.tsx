import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SlidersHorizontal, Cpu, Brain, Zap, Save, RotateCcw, Crosshair } from "lucide-react";
import { useModelSettings } from "./model-settings/useModelSettings";
import { DetectionTab } from "./model-settings/DetectionTab";
import { ModelsTab } from "./model-settings/ModelsTab";
import { InferenceTab } from "./model-settings/InferenceTab";
import { VlmTab } from "./model-settings/VlmTab";

export default function ModelSettings() {
  const {
    isConnected,
    healthData,
    detection,
    updateDetection,
    activeDetector,
    setActiveDetector,
    inference,
    setInference,
    vlm,
    setVlm,
    stream,
    setStream,
    classFilterText,
    setClassFilterText,
    handleSaveAll,
    handleReset,
  } = useModelSettings();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <SlidersHorizontal className="h-5 w-5 text-terminal-green" />
          <h1 className="text-2xl font-semibold">Model Settings</h1>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={`font-mono text-xs ${isConnected ? "border-terminal-green/30 text-terminal-green" : "border-muted-foreground/30 text-muted-foreground"}`}
          >
            {isConnected ? `Connected — ${healthData?.model || "unknown"}` : "Offline"}
          </Badge>
        </div>
      </div>

      <p className="text-sm text-muted-foreground max-w-2xl">
        Configure detection parameters, model selection, inference backends, and
        VLM reasoning settings. Changes are saved locally and applied on the next
        inference request.
      </p>

      <div className="flex gap-2">
        <Button onClick={handleSaveAll} className="gap-2">
          <Save className="h-4 w-4" />
          Save All Settings
        </Button>
        <Button variant="outline" onClick={handleReset} className="gap-2">
          <RotateCcw className="h-4 w-4" />
          Reset to Defaults
        </Button>
      </div>

      <Tabs defaultValue="detection" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="detection" className="gap-1.5">
            <Crosshair className="h-3.5 w-3.5" />
            Detection
          </TabsTrigger>
          <TabsTrigger value="models" className="gap-1.5">
            <Cpu className="h-3.5 w-3.5" />
            Models
          </TabsTrigger>
          <TabsTrigger value="inference" className="gap-1.5">
            <Zap className="h-3.5 w-3.5" />
            Inference
          </TabsTrigger>
          <TabsTrigger value="vlm" className="gap-1.5">
            <Brain className="h-3.5 w-3.5" />
            VLM / Cortex
          </TabsTrigger>
        </TabsList>

        <TabsContent value="detection" className="space-y-4">
          <DetectionTab
            detection={detection}
            updateDetection={updateDetection}
            classFilterText={classFilterText}
            onClassFilterTextChange={setClassFilterText}
          />
        </TabsContent>

        <TabsContent value="models" className="space-y-4">
          <ModelsTab
            activeDetector={activeDetector}
            setActiveDetector={setActiveDetector}
            vlm={vlm}
            setVlm={setVlm}
          />
        </TabsContent>

        <TabsContent value="inference" className="space-y-4">
          <InferenceTab
            inference={inference}
            setInference={setInference}
            stream={stream}
            setStream={setStream}
          />
        </TabsContent>

        <TabsContent value="vlm" className="space-y-4">
          <VlmTab
            vlm={vlm}
            setVlm={setVlm}
            activeDetector={activeDetector}
            detection={detection}
            inference={inference}
            stream={stream}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
