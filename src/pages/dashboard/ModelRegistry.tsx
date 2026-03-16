import { useState, useEffect, useMemo } from "react";
import { useOpenEyeConnection } from "@/hooks/useOpenEyeConnection";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Cpu,
  Download,
  CheckCircle2,
  Terminal,
  Trash2,
  HardDrive,
  Eye,
  Layers,
  Brain,
  Zap,
  Box,
  Crosshair,
  Cloud,
  Server,
  ArrowRight,
  ExternalLink,
  Clock,
  ChevronRight,
  Gauge,
} from "lucide-react";
import { toast } from "sonner";
import {
  modelGroups,
  benchmarks,
  adapterSteps,
} from "@/data/modelsData";
import { vlmModelOptions, cortexLlmOptions } from "@/data/modelOptions";
import { ModelRegistryFilters } from "@/components/dashboard/model-registry/ModelRegistryFilters";
import { ModelRegistryTable } from "@/components/dashboard/model-registry/ModelRegistryTable";
import { ModelDetailPanel } from "@/components/dashboard/model-registry/ModelDetailPanel";
import type { ModelEntry } from "@/components/dashboard/model-registry/types";

// ── Registry data helpers ────────────────────────────────────────────────────

const MODEL_SIZES: Record<string, { size_mb?: number; extras?: string; adapter: string }> = {
  YOLOv8: { size_mb: 22, extras: "pip install openeye-sh[yolo]", adapter: "yolov8" },
  YOLO26: { size_mb: 5, extras: "pip install openeye-sh[yolo]", adapter: "yolo26" },
  "RF-DETR": { size_mb: 39, extras: "pip install openeye-sh[rfdetr]", adapter: "rf_detr" },
  YOLOWorld: { adapter: "yoloworld" },
  "SAM 2": { size_mb: 38, extras: "pip install openeye-sh[sam]", adapter: "sam2" },
  "Grounded-SAM": { adapter: "grounded_sam" },
  FastSAM: { adapter: "fastsam" },
  "Qwen2.5-VL": { adapter: "qwen_vl", extras: "pip install openeye-sh[vlm]" },
  "InternVL 2.5": { adapter: "internvl" },
  "Phi-3 Vision": { adapter: "phi3_vision" },
  "Grounding DINO": { size_mb: 694, extras: "pip install openeye-sh[grounding]", adapter: "grounding_dino" },
  OWLv2: { adapter: "owlv2" },
  "Depth Anything V2": { size_mb: 97, extras: "pip install openeye-sh[depth]", adapter: "depth_anything" },
  DUSt3R: { adapter: "dust3r" },
  SmolVLA: { size_mb: 500, extras: "pip install openeye-sh[vla]", adapter: "smolvla" },
};

function buildRegistryModels(): ModelEntry[] {
  return modelGroups.flatMap((group) =>
    group.models.map((m) => {
      const meta = MODEL_SIZES[m.name] ?? { adapter: m.name.toLowerCase().replace(/[\s.-]+/g, "_") };
      return {
        key: meta.adapter,
        name: m.name,
        creator: m.creator,
        task: group.category,
        category: group.category,
        categoryColor: group.color,
        adapter: meta.adapter,
        role: m.role,
        description: m.description,
        status: m.status,
        downloaded: false,
        size_mb: meta.size_mb,
        performance: m.performance,
        provider: m.provider,
        extras: meta.extras,
      };
    }),
  );
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  "Real-Time Detection": <Crosshair className="h-3.5 w-3.5" />,
  Segmentation: <Layers className="h-3.5 w-3.5" />,
  "Vision-Language Models": <Brain className="h-3.5 w-3.5" />,
  "Detection Frameworks": <Eye className="h-3.5 w-3.5" />,
  "Depth & 3D": <Box className="h-3.5 w-3.5" />,
  "Vision-Language-Action": <Zap className="h-3.5 w-3.5" />,
};

// ── Component ───────────────────────────────────────────────────────────────

export default function ModelRegistry() {
  const { isConnected, healthData } = useOpenEyeConnection();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "integrated" | "planned">("all");
  const [models, setModels] = useState<ModelEntry[]>(buildRegistryModels);

  // Mark active model as downloaded
  useEffect(() => {
    if (!healthData?.model) return;
    setModels((prev) =>
      prev.map((m) =>
        healthData.model.toLowerCase().includes(m.key.replace(/_/g, ""))
          ? { ...m, downloaded: true }
          : m,
      ),
    );
  }, [healthData]);

  const categories = useMemo(
    () => ["all", ...modelGroups.map((g) => g.category)],
    [],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return models.filter((m) => {
      if (categoryFilter !== "all" && m.category !== categoryFilter) return false;
      if (statusFilter !== "all" && m.status !== statusFilter) return false;
      if (
        q &&
        !m.name.toLowerCase().includes(q) &&
        !m.task.toLowerCase().includes(q) &&
        !m.key.toLowerCase().includes(q) &&
        !m.creator.toLowerCase().includes(q) &&
        !m.role.toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [models, search, categoryFilter, statusFilter]);

  const integratedCount = models.filter((m) => m.status === "integrated").length;
  const plannedCount = models.filter((m) => m.status === "planned").length;
  const downloadedCount = models.filter((m) => m.downloaded).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Cpu className="h-5 w-5 text-terminal-green" />
          <h1 className="text-2xl font-semibold">Model Registry</h1>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="font-mono text-xs border-terminal-green/30 text-terminal-green"
          >
            {integratedCount} integrated
          </Badge>
          <Badge
            variant="outline"
            className="font-mono text-xs border-terminal-amber/30 text-terminal-amber"
          >
            {plannedCount} planned
          </Badge>
          {isConnected && (
            <Badge
              variant="outline"
              className="font-mono text-xs border-terminal-green/30 text-terminal-green"
            >
              {healthData?.model || "connected"}
            </Badge>
          )}
        </div>
      </div>

      <p className="text-sm text-muted-foreground max-w-2xl">
        Browse all supported vision models across detection, segmentation,
        depth, VLM reasoning, and robotic action generation. Models are managed
        via the CLI — use{" "}
        <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">
          openeye pull
        </code>{" "}
        to download and{" "}
        <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">
          openeye run
        </code>{" "}
        to start inference.
      </p>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          icon={<HardDrive className="h-4 w-4" />}
          label="Total Models"
          value={models.length}
          color="text-foreground"
        />
        <StatCard
          icon={<CheckCircle2 className="h-4 w-4 text-terminal-green" />}
          label="Integrated"
          value={integratedCount}
          color="text-terminal-green"
        />
        <StatCard
          icon={<Clock className="h-4 w-4 text-terminal-amber" />}
          label="On Roadmap"
          value={plannedCount}
          color="text-terminal-amber"
        />
        <StatCard
          icon={<Download className="h-4 w-4 text-terminal-green" />}
          label="Downloaded"
          value={`${downloadedCount}/${integratedCount}`}
          color="text-terminal-green"
        />
      </div>

      {/* Main tabs */}
      <Tabs defaultValue="local" className="space-y-4">
        <TabsList>
          <TabsTrigger value="local" className="gap-1.5">
            <Server className="h-3.5 w-3.5" />
            Local Models
          </TabsTrigger>
          <TabsTrigger value="cloud" className="gap-1.5">
            <Cloud className="h-3.5 w-3.5" />
            Cloud VLM / LLM
          </TabsTrigger>
          <TabsTrigger value="benchmarks" className="gap-1.5">
            <Gauge className="h-3.5 w-3.5" />
            Benchmarks
          </TabsTrigger>
          <TabsTrigger value="adapters" className="gap-1.5">
            <ArrowRight className="h-3.5 w-3.5" />
            Adapter Pattern
          </TabsTrigger>
        </TabsList>

        {/* ── Local Models Tab ─────────────────────────────────────── */}
        <TabsContent value="local" className="space-y-4">
          <ModelRegistryFilters
            search={search}
            onSearchChange={setSearch}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            categoryFilter={categoryFilter}
            onCategoryFilterChange={setCategoryFilter}
            categories={categories}
            categoryIcons={CATEGORY_ICONS}
          />

          <ModelRegistryTable
            models={filtered}
            categoryFilter={categoryFilter}
            activeModelKey={healthData?.model}
          />

          <ModelDetailPanel models={filtered} />
        </TabsContent>

        {/* ── Cloud VLM / LLM Tab ──────────────────────────────────── */}
        <TabsContent value="cloud" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Brain className="h-4 w-4 text-terminal-amber" />
                VLM Models (Vision-Language)
              </CardTitle>
              <CardDescription>
                Multimodal models for scene reasoning, accessed via cloud API.
                Selected in{" "}
                <span className="font-mono text-xs">Model Settings</span> or{" "}
                <span className="font-mono text-xs">Config Editor</span>.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Model</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Model ID</TableHead>
                    <TableHead className="text-right">Tier</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vlmModelOptions.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.label}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="text-xs font-mono"
                        >
                          {m.provider}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground max-w-[200px] truncate">
                        {m.id}
                      </TableCell>
                      <TableCell className="text-right">
                        {m.free ? (
                          <Badge className="bg-terminal-green/15 text-terminal-green border-terminal-green/30 text-xs">
                            Free
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            Paid
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4 text-purple-400" />
                Cortex LLM Models (Reasoning / Planning)
              </CardTitle>
              <CardDescription>
                Text-only reasoning models for the cortex planning layer and
                agentic loop.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Model</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Model ID</TableHead>
                    <TableHead className="text-right">Tier</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cortexLlmOptions.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.label}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="text-xs font-mono"
                        >
                          {m.provider}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground max-w-[200px] truncate">
                        {m.id}
                      </TableCell>
                      <TableCell className="text-right">
                        {m.free ? (
                          <Badge className="bg-terminal-green/15 text-terminal-green border-terminal-green/30 text-xs">
                            Free
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            Paid
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Provider info */}
          <div className="grid gap-3 sm:grid-cols-2">
            <ProviderCard
              name="Nebius Token Factory"
              description="High-throughput inference for Qwen and DeepSeek models. Set NEBIUS_API_KEY in your environment."
              envVar="NEBIUS_API_KEY"
            />
            <ProviderCard
              name="OpenRouter"
              description="Unified API gateway to 200+ models including free tiers. Set OPENROUTER_API_KEY in your environment."
              envVar="OPENROUTER_API_KEY"
            />
          </div>
        </TabsContent>

        {/* ── Benchmarks Tab ───────────────────────────────────────── */}
        <TabsContent value="benchmarks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Gauge className="h-4 w-4 text-terminal-green" />
                Performance Benchmarks
              </CardTitle>
              <CardDescription>
                Inference speed measured on NVIDIA RTX 4090. Accuracy on standard
                benchmarks (COCO val for detection, zero-shot for segmentation).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Model</TableHead>
                    <TableHead>Task</TableHead>
                    <TableHead className="text-terminal-green">Speed</TableHead>
                    <TableHead>Accuracy</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Backend</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {benchmarks.map((row) => (
                    <TableRow key={row.model}>
                      <TableCell className="font-medium">
                        {row.model}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs font-mono">
                          {row.task}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm text-terminal-green">
                        {row.speed}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {row.accuracy}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground tabular-nums">
                        {row.size}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {row.backend}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Speed comparison visual */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Relative Speed</CardTitle>
              <CardDescription>
                Inference latency comparison — shorter bars are faster.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {benchmarks.map((row) => {
                const ms = parseFloat(row.speed.replace(/[^0-9.]/g, "")) || 0;
                const unit = row.speed.includes("s") && !row.speed.includes("ms") ? "s" : "ms";
                const msNorm = unit === "s" ? ms * 1000 : ms;
                const maxMs = 2000;
                const pct = Math.min((msNorm / maxMs) * 100, 100);
                return (
                  <div key={row.model} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium">{row.model}</span>
                      <span className="font-mono text-terminal-green">
                        {row.speed}
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.max(pct, 2)}%`,
                          backgroundColor:
                            msNorm < 10
                              ? "hsl(var(--terminal-green))"
                              : msNorm < 100
                                ? "hsl(var(--terminal-amber))"
                                : "hsl(var(--muted-foreground))",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <div className="p-3 bg-muted/50 rounded-md border">
            <div className="flex items-start gap-2">
              <Terminal className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="text-xs text-muted-foreground space-y-1">
                <p className="font-medium">
                  Run your own benchmarks with the CLI:
                </p>
                <code className="block font-mono text-terminal-green">
                  $ openeye bench yolov8 --runs 50 --width 640 --height 480
                </code>
                <p>
                  Or use the dashboard{" "}
                  <span className="font-medium text-foreground">Benchmark</span>{" "}
                  page for end-to-end latency measurements including network
                  round-trip.
                </p>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ── Adapter Pattern Tab ──────────────────────────────────── */}
        <TabsContent value="adapters" className="space-y-4">
          {/* Steps */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {adapterSteps.map((step, i) => (
              <Card key={step.step}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xl font-semibold text-terminal-green/40">
                      {step.step}
                    </span>
                    {i < adapterSteps.length - 1 && (
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground ml-auto hidden lg:block" />
                    )}
                  </div>
                  <div className="text-sm font-medium">{step.title}</div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Code example */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Terminal className="h-4 w-4" />
                Example Adapter Implementation
              </CardTitle>
              <CardDescription>
                Every model implements a shared interface — load, predict,
                postprocess. Adding a new model means writing one file.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border bg-secondary overflow-hidden">
                <div className="px-4 py-2 border-b flex items-center gap-2 bg-muted/30">
                  <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                  <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                  <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                  <span className="font-mono text-[10px] text-muted-foreground ml-2">
                    adapters/yolo_adapter.py
                  </span>
                </div>
                <pre className="px-5 py-4 font-mono text-xs text-oe-green overflow-x-auto leading-relaxed">
                  <code>{`class YOLOAdapter(ModelAdapter):
    """Drop-in adapter for any YOLO model."""

    def load(self, weights: str = "yolo26n.pt"):
        self.model = YOLO(weights)

    def predict(self, frame: np.ndarray) -> list[Detection]:
        results = self.model(frame, conf=self.conf)
        return self.postprocess(results)

# Register — one line, done.
registry.register("yolo26", YOLOAdapter)`}</code>
                </pre>
              </div>
            </CardContent>
          </Card>

          {/* Interface contract */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ExternalLink className="h-4 w-4" />
                ModelAdapter Interface
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border bg-secondary overflow-hidden">
                <div className="px-4 py-2 border-b flex items-center gap-2 bg-muted/30">
                  <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                  <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                  <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                  <span className="font-mono text-[10px] text-muted-foreground ml-2">
                    adapters/base.py
                  </span>
                </div>
                <pre className="px-5 py-4 font-mono text-xs text-oe-green overflow-x-auto leading-relaxed">
                  <code>{`class ModelAdapter(ABC):
    """Base interface that every vision model must implement."""

    @abstractmethod
    def load(self, weights: str, device: str = "cpu") -> None:
        """Load model weights and prepare for inference."""

    @abstractmethod
    def predict(self, frame: np.ndarray, **kwargs) -> list[Detection]:
        """Run inference on a single frame."""

    def postprocess(self, raw_output) -> list[Detection]:
        """Convert raw model output into Detection objects."""
        ...

    def warmup(self, input_shape: tuple[int, ...]) -> None:
        """Optional warmup pass with dummy data."""
        self.predict(np.zeros(input_shape, dtype=np.uint8))`}</code>
                </pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* CLI Quick Reference — always visible */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Terminal className="h-4 w-4" />
            CLI Quick Reference
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <CliCommandCard
              icon={<Download className="h-4 w-4 text-terminal-green" />}
              title="Pull a model"
              command="openeye pull yolov8"
              description="Download weights to ~/.openeye/models/"
            />
            <CliCommandCard
              icon={<Cpu className="h-4 w-4 text-terminal-amber" />}
              title="Run inference"
              command="openeye run yolov8 photo.jpg"
              description="Run detection on a single image"
            />
            <CliCommandCard
              icon={<Eye className="h-4 w-4 text-blue-400" />}
              title="List models"
              command="openeye list"
              description="Show all available and downloaded models"
            />
            <CliCommandCard
              icon={<Trash2 className="h-4 w-4 text-destructive" />}
              title="Remove a model"
              command="openeye remove yolov8"
              description="Delete downloaded model weights"
            />
          </div>

          <div className="p-3 bg-muted/50 rounded-md border">
            <p className="text-xs text-muted-foreground mb-2 font-medium">
              Install extras for specific model families:
            </p>
            <div className="space-y-1">
              {[
                { cmd: "pip install openeye-sh[yolo]", note: "YOLO + YOLO26" },
                { cmd: "pip install openeye-sh[grounding]", note: "Grounding DINO" },
                { cmd: "pip install openeye-sh[sam]", note: "SAM 2 segmentation" },
                { cmd: "pip install openeye-sh[depth]", note: "Depth Anything V2" },
                { cmd: "pip install openeye-sh[vla]", note: "SmolVLA actions" },
                { cmd: "pip install openeye-sh[vlm]", note: "VLM inference" },
              ].map((item) => (
                <code
                  key={item.cmd}
                  className="block text-xs font-mono text-muted-foreground"
                >
                  $ {item.cmd}{" "}
                  <span className="text-muted-foreground/60">
                    # {item.note}
                  </span>
                </code>
              ))}
              <code className="block text-xs font-mono text-terminal-green">
                $ pip install openeye-sh[all]{" "}
                <span className="text-muted-foreground"># everything</span>
              </code>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          {icon}
          <span className="text-xs">{label}</span>
        </div>
        <p className={`text-lg font-semibold tabular-nums font-mono ${color}`}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function CliCommandCard({
  icon,
  title,
  command,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  command: string;
  description: string;
}) {
  const handleCopy = () => {
    navigator.clipboard.writeText(command);
    toast.success("Copied to clipboard");
  };

  return (
    <button
      onClick={handleCopy}
      className="rounded-md border bg-card p-3 space-y-2 text-left hover:bg-accent transition-colors w-full"
    >
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm font-medium">{title}</span>
      </div>
      <code className="block text-xs font-mono bg-secondary text-oe-green px-2 py-1.5 rounded">
        $ {command}
      </code>
      <p className="text-xs text-muted-foreground">{description}</p>
    </button>
  );
}

function ProviderCard({
  name,
  description,
  envVar,
}: {
  name: string;
  description: string;
  envVar: string;
}) {
  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Cloud className="h-4 w-4 text-terminal-amber" />
          <span className="text-sm font-medium">{name}</span>
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
        <code className="block text-xs font-mono bg-secondary text-oe-green px-2 py-1.5 rounded">
          export {envVar}="your-key-here"
        </code>
      </CardContent>
    </Card>
  );
}
