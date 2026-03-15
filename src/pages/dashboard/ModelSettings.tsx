import { useState, useEffect, useCallback } from "react";
import { useOpenEyeConnection } from "@/hooks/useOpenEyeConnection";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
import {
  SlidersHorizontal,
  Cpu,
  Brain,
  Zap,
  Save,
  RotateCcw,
  Eye,
  Crosshair,
  Layers,
  Thermometer,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { vlmModelOptions, cortexLlmOptions } from "@/data/modelOptions";
import type { ModelParameters } from "@/types/openeye";

// ── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_DETECTION: ModelParameters = {
  confidence_threshold: 0.5,
  nms_threshold: 0.45,
  max_detections: 100,
  class_filter: [],
};

const DEFAULT_INFERENCE = {
  device: "cpu" as const,
  precision: "fp32" as const,
  batch_size: 1,
  warmup: true,
  tensorrt: false,
};

const DEFAULT_VLM = {
  temperature: 0.7,
  max_tokens: 512,
  top_p: 0.9,
  vlm_model: "",
  cortex_llm: "",
};

const DEFAULT_STREAM = {
  hertz: 10,
  auto_reconnect: true,
  buffer_frames: 3,
};

const STORAGE_KEY = "openeye_model_params";
const INFERENCE_KEY = "openeye_inference_params";
const VLM_KEY = "openeye_vlm_params";
const STREAM_KEY = "openeye_stream_params";

const NONE_VALUE = "__none__";

const DETECTION_MODELS = [
  { id: "yolov8n", label: "YOLOv8 Nano", size: "6 MB", speed: "fastest" },
  { id: "yolov8s", label: "YOLOv8 Small", size: "22 MB", speed: "fast" },
  { id: "yolov8m", label: "YOLOv8 Medium", size: "52 MB", speed: "balanced" },
  { id: "yolov8l", label: "YOLOv8 Large", size: "87 MB", speed: "accurate" },
  { id: "yolov8x", label: "YOLOv8 XLarge", size: "131 MB", speed: "most accurate" },
  { id: "yolo26n", label: "YOLO26 Nano", size: "5 MB", speed: "fastest" },
  { id: "yolo26s", label: "YOLO26 Small", size: "18 MB", speed: "fast" },
  { id: "rf-detr-base", label: "RF-DETR Base", size: "130 MB", speed: "accurate" },
  { id: "grounding-dino", label: "Grounding DINO", size: "680 MB", speed: "open-vocab" },
];

// ── Helpers ─────────────────────────────────────────────────────────────────

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

function groupByProvider(options: typeof vlmModelOptions) {
  const groups: Record<string, typeof vlmModelOptions> = {};
  for (const m of options) {
    (groups[m.provider] ??= []).push(m);
  }
  return groups;
}

// ── Component ───────────────────────────────────────────────────────────────

export default function ModelSettings() {
  const { isConnected, healthData } = useOpenEyeConnection();

  // Detection state
  const [detection, setDetection] = useState<ModelParameters>(() =>
    loadJson(STORAGE_KEY, DEFAULT_DETECTION),
  );
  const [activeDetector, setActiveDetector] = useState("yolov8s");

  // Inference state
  const [inference, setInference] = useState(() =>
    loadJson(INFERENCE_KEY, DEFAULT_INFERENCE),
  );

  // VLM state
  const [vlm, setVlm] = useState(() => loadJson(VLM_KEY, DEFAULT_VLM));

  // Stream state
  const [stream, setStream] = useState(() =>
    loadJson(STREAM_KEY, DEFAULT_STREAM),
  );

  // Sync active model from health check
  useEffect(() => {
    if (healthData?.model) {
      const normalized = healthData.model.toLowerCase().replace(/[^a-z0-9]/g, "");
      const match = DETECTION_MODELS.find((m) =>
        normalized.includes(m.id.replace(/-/g, "")),
      );
      if (match) setActiveDetector(match.id);
    }
  }, [healthData]);

  // Class filter as comma string for input
  const [classFilterText, setClassFilterText] = useState(
    detection.class_filter.join(", "),
  );

  const updateDetection = useCallback(
    (patch: Partial<ModelParameters>) =>
      setDetection((prev) => ({ ...prev, ...patch })),
    [],
  );

  const handleSaveAll = () => {
    const classFilter = classFilterText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const detectionFinal = { ...detection, class_filter: classFilter };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(detectionFinal));
    localStorage.setItem(INFERENCE_KEY, JSON.stringify(inference));
    localStorage.setItem(VLM_KEY, JSON.stringify(vlm));
    localStorage.setItem(STREAM_KEY, JSON.stringify(stream));
    toast.success("All settings saved");
  };

  const handleReset = () => {
    setDetection(DEFAULT_DETECTION);
    setClassFilterText("");
    setInference(DEFAULT_INFERENCE);
    setVlm(DEFAULT_VLM);
    setStream(DEFAULT_STREAM);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(INFERENCE_KEY);
    localStorage.removeItem(VLM_KEY);
    localStorage.removeItem(STREAM_KEY);
    toast.success("Settings reset to defaults");
  };

  const vlmByProvider = groupByProvider(vlmModelOptions);
  const cortexByProvider = groupByProvider(cortexLlmOptions);

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

      {/* Action buttons */}
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

      {/* Tabs */}
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

        {/* ── Detection Tab ───────────────────────────────────────────── */}
        <TabsContent value="detection" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Crosshair className="h-4 w-4 text-terminal-green" />
                Detection Parameters
              </CardTitle>
              <CardDescription>
                Client-side filtering applied to detection results before display.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Confidence threshold */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Confidence Threshold</Label>
                  <span className="text-sm font-mono tabular-nums text-terminal-green">
                    {detection.confidence_threshold.toFixed(2)}
                  </span>
                </div>
                <Slider
                  value={[detection.confidence_threshold]}
                  onValueChange={([v]) =>
                    updateDetection({ confidence_threshold: v })
                  }
                  min={0}
                  max={1}
                  step={0.01}
                />
                <p className="text-xs text-muted-foreground">
                  Minimum confidence score to display a detection. Lower values
                  show more detections; higher values filter out uncertain ones.
                </p>
              </div>

              {/* NMS threshold */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>NMS Threshold (IoU)</Label>
                  <span className="text-sm font-mono tabular-nums text-terminal-amber">
                    {detection.nms_threshold.toFixed(2)}
                  </span>
                </div>
                <Slider
                  value={[detection.nms_threshold]}
                  onValueChange={([v]) =>
                    updateDetection({ nms_threshold: v })
                  }
                  min={0}
                  max={1}
                  step={0.01}
                />
                <p className="text-xs text-muted-foreground">
                  Non-Maximum Suppression IoU overlap threshold. Lower values
                  suppress more overlapping boxes.
                </p>
              </div>

              {/* Max detections */}
              <div className="space-y-2">
                <Label htmlFor="max-detections">Max Detections</Label>
                <Input
                  id="max-detections"
                  type="number"
                  value={detection.max_detections}
                  onChange={(e) =>
                    updateDetection({
                      max_detections: Math.max(
                        1,
                        Math.min(1000, Math.floor(Number(e.target.value) || 1)),
                      ),
                    })
                  }
                  min={1}
                  max={1000}
                  className="max-w-[200px]"
                />
                <p className="text-xs text-muted-foreground">
                  Maximum number of objects to display per frame (1–1000).
                </p>
              </div>

              {/* Class filter */}
              <div className="space-y-2">
                <Label htmlFor="class-filter">Class Filter</Label>
                <Input
                  id="class-filter"
                  value={classFilterText}
                  onChange={(e) => setClassFilterText(e.target.value)}
                  placeholder="e.g. person, car, dog"
                />
                <p className="text-xs text-muted-foreground">
                  Comma-separated list of COCO class names to show. Leave empty
                  to display all classes.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Quick presets */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Layers className="h-4 w-4" />
                Quick Presets
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-3">
                <PresetButton
                  label="High Recall"
                  description="Catch everything — low confidence, high NMS"
                  onClick={() => {
                    updateDetection({
                      confidence_threshold: 0.15,
                      nms_threshold: 0.7,
                      max_detections: 300,
                    });
                    toast.success("Applied High Recall preset");
                  }}
                />
                <PresetButton
                  label="Balanced"
                  description="Good balance of precision and recall"
                  onClick={() => {
                    updateDetection({
                      confidence_threshold: 0.5,
                      nms_threshold: 0.45,
                      max_detections: 100,
                    });
                    toast.success("Applied Balanced preset");
                  }}
                />
                <PresetButton
                  label="High Precision"
                  description="Only high-confidence detections"
                  onClick={() => {
                    updateDetection({
                      confidence_threshold: 0.75,
                      nms_threshold: 0.3,
                      max_detections: 50,
                    });
                    toast.success("Applied High Precision preset");
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Models Tab ──────────────────────────────────────────────── */}
        <TabsContent value="models" className="space-y-4">
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
                  setVlm((prev: typeof vlm) => ({
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
                  setVlm((prev: typeof vlm) => ({
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
        </TabsContent>

        {/* ── Inference Tab ───────────────────────────────────────────── */}
        <TabsContent value="inference" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Cpu className="h-4 w-4 text-terminal-green" />
                Compute Backend
              </CardTitle>
              <CardDescription>
                Hardware and precision settings for model inference.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Device */}
              <div className="space-y-2">
                <Label>Device</Label>
                <Select
                  value={inference.device}
                  onValueChange={(v: string) =>
                    setInference((prev) => ({
                      ...prev,
                      device: v as typeof prev.device,
                    }))
                  }
                >
                  <SelectTrigger className="max-w-[250px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cpu">CPU</SelectItem>
                    <SelectItem value="cuda">CUDA (GPU)</SelectItem>
                    <SelectItem value="mps">
                      MPS (Apple Silicon)
                    </SelectItem>
                    <SelectItem value="tensorrt">TensorRT</SelectItem>
                    <SelectItem value="onnx">ONNX Runtime</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Hardware backend for model execution. CUDA requires an NVIDIA
                  GPU; MPS requires Apple Silicon.
                </p>
              </div>

              {/* Precision */}
              <div className="space-y-2">
                <Label>Precision</Label>
                <Select
                  value={inference.precision}
                  onValueChange={(v) =>
                    setInference((prev: typeof inference) => ({
                      ...prev,
                      precision: v,
                    }))
                  }
                >
                  <SelectTrigger className="max-w-[250px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fp32">FP32 (Full)</SelectItem>
                    <SelectItem value="fp16">FP16 (Half)</SelectItem>
                    <SelectItem value="int8">INT8 (Quantized)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Lower precision is faster and uses less memory but may
                  reduce accuracy slightly.
                </p>
              </div>

              {/* Batch size */}
              <div className="space-y-2">
                <Label htmlFor="batch-size">Batch Size</Label>
                <Input
                  id="batch-size"
                  type="number"
                  value={inference.batch_size}
                  onChange={(e) =>
                    setInference((prev: typeof inference) => ({
                      ...prev,
                      batch_size: Math.max(
                        1,
                        Math.min(32, Math.floor(Number(e.target.value) || 1)),
                      ),
                    }))
                  }
                  min={1}
                  max={32}
                  className="max-w-[200px]"
                />
                <p className="text-xs text-muted-foreground">
                  Number of frames to process in a single batch (1–32). Higher
                  values improve throughput on GPUs.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4 text-terminal-amber" />
                Performance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Warmup */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Warmup on Start</Label>
                  <p className="text-xs text-muted-foreground">
                    Run a dummy inference pass on startup to warm the model.
                  </p>
                </div>
                <Switch
                  checked={inference.warmup}
                  onCheckedChange={(v) =>
                    setInference((prev: typeof inference) => ({
                      ...prev,
                      warmup: v,
                    }))
                  }
                />
              </div>

              {/* TensorRT optimization */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>TensorRT Optimization</Label>
                  <p className="text-xs text-muted-foreground">
                    Export and optimize the model with TensorRT (NVIDIA only).
                  </p>
                </div>
                <Switch
                  checked={inference.tensorrt}
                  onCheckedChange={(v) =>
                    setInference((prev: typeof inference) => ({
                      ...prev,
                      tensorrt: v,
                    }))
                  }
                />
              </div>

              {/* Stream Hz */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Stream Rate</Label>
                  <span className="text-sm font-mono tabular-nums">
                    {stream.hertz} Hz
                  </span>
                </div>
                <Slider
                  value={[stream.hertz]}
                  onValueChange={([v]) =>
                    setStream((prev: typeof stream) => ({ ...prev, hertz: v }))
                  }
                  min={1}
                  max={60}
                  step={1}
                />
                <p className="text-xs text-muted-foreground">
                  Target frames per second for the WebSocket camera stream.
                </p>
              </div>

              {/* Buffer frames */}
              <div className="space-y-2">
                <Label htmlFor="buffer-frames">Buffer Frames</Label>
                <Input
                  id="buffer-frames"
                  type="number"
                  value={stream.buffer_frames}
                  onChange={(e) =>
                    setStream((prev: typeof stream) => ({
                      ...prev,
                      buffer_frames: Math.max(
                        0,
                        Math.min(30, Math.floor(Number(e.target.value) || 0)),
                      ),
                    }))
                  }
                  min={0}
                  max={30}
                  className="max-w-[200px]"
                />
                <p className="text-xs text-muted-foreground">
                  Number of frames to buffer before displaying (0–30). Higher
                  values smooth playback but add latency.
                </p>
              </div>

              {/* Auto-reconnect */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Auto-Reconnect</Label>
                  <p className="text-xs text-muted-foreground">
                    Automatically reconnect WebSocket on disconnect.
                  </p>
                </div>
                <Switch
                  checked={stream.auto_reconnect}
                  onCheckedChange={(v) =>
                    setStream((prev: typeof stream) => ({
                      ...prev,
                      auto_reconnect: v,
                    }))
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── VLM / Cortex Tab ────────────────────────────────────────── */}
        <TabsContent value="vlm" className="space-y-4">
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
                    setVlm((prev: typeof vlm) => ({ ...prev, temperature: v }))
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
                    setVlm((prev: typeof vlm) => ({ ...prev, top_p: v }))
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
                    setVlm((prev: typeof vlm) => ({
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
                    setVlm((prev: typeof vlm) => ({
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
                    setVlm((prev: typeof vlm) => ({
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
                    setVlm((prev: typeof vlm) => ({
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
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function PresetButton({
  label,
  description,
  onClick,
}: {
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-md border bg-card p-3 text-left space-y-1 hover:bg-accent transition-colors"
    >
      <span className="text-sm font-medium">{label}</span>
      <p className="text-xs text-muted-foreground">{description}</p>
    </button>
  );
}

function ConfigSummaryItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border px-3 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-mono font-medium">{value}</span>
    </div>
  );
}
