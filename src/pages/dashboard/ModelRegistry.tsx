import { useState, useEffect, useMemo } from "react";
import { useOpenEyeConnection } from "@/hooks/useOpenEyeConnection";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Cpu,
  Download,
  CheckCircle2,
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
  Clock,
  Gauge,
} from "lucide-react";
import {
  modelGroups,
} from "@/data/modelsData";
import { ModelRegistryFilters } from "@/components/dashboard/model-registry/ModelRegistryFilters";
import { ModelRegistryTable } from "@/components/dashboard/model-registry/ModelRegistryTable";
import { ModelDetailPanel } from "@/components/dashboard/model-registry/ModelDetailPanel";
import { StatCard } from "@/components/dashboard/model-registry/StatCard";
import { CloudModelsTab } from "@/components/dashboard/model-registry/CloudModelsTab";
import { BenchmarksTab } from "@/components/dashboard/model-registry/BenchmarksTab";
import { AdaptersTab } from "@/components/dashboard/model-registry/AdaptersTab";
import { CliQuickReference } from "@/components/dashboard/model-registry/CliQuickReference";
import type { ModelEntry } from "@/components/dashboard/model-registry/types";

// ── Registry data helpers ────────────────────────────────────────────────────

const MODEL_SIZES: Record<string, { size_mb?: number; extras?: string; adapter: string }> = {
  YOLOv8: { size_mb: 22, extras: "pipx install openeye-sh[yolo]", adapter: "yolov8" },
  YOLO26: { size_mb: 5, extras: "pipx install openeye-sh[yolo]", adapter: "yolo26" },
  "RF-DETR": { size_mb: 39, extras: "pipx install openeye-sh[rfdetr]", adapter: "rf_detr" },
  YOLOWorld: { adapter: "yoloworld" },
  "SAM 2": { size_mb: 38, extras: "pipx install openeye-sh[sam]", adapter: "sam2" },
  "Grounded-SAM": { adapter: "grounded_sam" },
  FastSAM: { adapter: "fastsam" },
  "Qwen2.5-VL": { adapter: "qwen_vl", extras: "pipx install openeye-sh[vlm]" },
  "InternVL 2.5": { adapter: "internvl" },
  "Phi-3 Vision": { adapter: "phi3_vision" },
  "Grounding DINO": { size_mb: 694, extras: "pipx install openeye-sh[grounding]", adapter: "grounding_dino" },
  OWLv2: { adapter: "owlv2" },
  "Depth Anything V2": { size_mb: 97, extras: "pipx install openeye-sh[depth]", adapter: "depth_anything" },
  DUSt3R: { adapter: "dust3r" },
  SmolVLA: { size_mb: 500, extras: "pipx install openeye-sh[vla]", adapter: "smolvla" },
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
          <CloudModelsTab />
        </TabsContent>

        {/* ── Benchmarks Tab ───────────────────────────────────────── */}
        <TabsContent value="benchmarks" className="space-y-4">
          <BenchmarksTab />
        </TabsContent>

        {/* ── Adapter Pattern Tab ──────────────────────────────────── */}
        <TabsContent value="adapters" className="space-y-4">
          <AdaptersTab />
        </TabsContent>
      </Tabs>

      {/* CLI Quick Reference — always visible */}
      <CliQuickReference />
    </div>
  );
}
