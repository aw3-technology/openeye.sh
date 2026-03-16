import { useState, useMemo } from "react";
import { useInferenceHistory } from "@/hooks/useOpenEyeQueries";
import type { InferenceHistoryRow } from "@/types/openeye";
import { HistoryStatsCards, type HistoryStats } from "@/components/dashboard/history/HistoryStatsCards";
import { HistoryFilterBar } from "@/components/dashboard/history/HistoryFilterBar";
import { HistoryTimeline } from "@/components/dashboard/history/HistoryTimeline";
import { HistoryDetailDialog } from "@/components/dashboard/history/HistoryDetailDialog";
import { parseObjects } from "@/components/dashboard/history/utils";

const PAGE_SIZE = 20;

export default function History() {
  const [page, setPage] = useState(0);
  const { data, isLoading } = useInferenceHistory(page, PAGE_SIZE);
  const [selected, setSelected] = useState<InferenceHistoryRow | null>(null);
  const [modelFilter, setModelFilter] = useState("all");
  const [taskFilter, setTaskFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const rows = data?.data || [];
  const totalCount = data?.count || 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const uniqueModels = useMemo(
    () => [...new Set(rows.map((r) => r.model))].sort(),
    [rows],
  );
  const uniqueTasks = useMemo(
    () => [...new Set(rows.map((r) => r.task))].sort(),
    [rows],
  );

  const filteredRows = useMemo(() => {
    let result = rows;
    if (modelFilter !== "all") {
      result = result.filter((r) => r.model === modelFilter);
    }
    if (taskFilter !== "all") {
      result = result.filter((r) => r.task === taskFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((r) => {
        const objects = parseObjects(r.objects_json);
        return (
          r.model.toLowerCase().includes(q) ||
          r.task.toLowerCase().includes(q) ||
          objects.some((o) => o.label.toLowerCase().includes(q))
        );
      });
    }
    return result;
  }, [rows, modelFilter, taskFilter, searchQuery]);

  const stats = useMemo<HistoryStats | null>(() => {
    if (rows.length === 0) return null;
    const totalObjs = rows.reduce((sum, r) => sum + r.object_count, 0);
    const avgLatency =
      rows.reduce((sum, r) => sum + r.inference_ms, 0) / rows.length;
    const labelCounts: Record<string, number> = {};
    rows.forEach((r) => {
      parseObjects(r.objects_json).forEach((o) => {
        labelCounts[o.label] = (labelCounts[o.label] || 0) + 1;
      });
    });
    const topLabel = Object.entries(labelCounts).sort(
      (a, b) => b[1] - a[1],
    )[0];
    return {
      totalInferences: totalCount,
      totalObjects: totalObjs,
      avgLatency,
      topLabel: topLabel ? `${topLabel[0]} (${topLabel[1]})` : "\u2014",
      uniqueModels: new Set(rows.map((r) => r.model)).size,
    };
  }, [rows, totalCount]);

  const hasFilters =
    modelFilter !== "all" || taskFilter !== "all" || searchQuery.trim() !== "";

  const clearFilters = () => {
    setModelFilter("all");
    setTaskFilter("all");
    setSearchQuery("");
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Inference History</h1>

      {stats && <HistoryStatsCards stats={stats} />}

      <HistoryFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        modelFilter={modelFilter}
        onModelFilterChange={setModelFilter}
        taskFilter={taskFilter}
        onTaskFilterChange={setTaskFilter}
        uniqueModels={uniqueModels}
        uniqueTasks={uniqueTasks}
        onClear={clearFilters}
        hasFilters={hasFilters}
      />

      <HistoryTimeline
        rows={rows}
        filteredRows={filteredRows}
        isLoading={isLoading}
        hasFilters={hasFilters}
        page={page}
        totalPages={totalPages}
        totalCount={totalCount}
        onPageChange={setPage}
        onSelect={setSelected}
      />

      <HistoryDetailDialog
        row={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
