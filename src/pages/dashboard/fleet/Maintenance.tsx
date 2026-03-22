import { useMemo, useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useMaintenanceWindows,
  useDeleteMaintenanceWindow,
} from "@/hooks/useFleetQueries";
import {
  Clock,
  CalendarClock,
  CalendarCheck,
  CalendarX,
} from "lucide-react";
import { toast } from "sonner";
import type { MaintenanceWindowResponse } from "@/types/fleet";
import { getWindowStatus, type FilterTab } from "@/components/fleet/maintenance/constants";
import { CreateMaintenanceDialog } from "@/components/fleet/maintenance/CreateMaintenanceDialog";
import { EditMaintenanceDialog } from "@/components/fleet/maintenance/EditMaintenanceDialog";
import { MaintenanceTable } from "@/components/fleet/maintenance/MaintenanceTable";
import { SummaryCard } from "@/components/fleet/maintenance/SummaryCard";

export default function Maintenance() {
  const { data: windows, isLoading } = useMaintenanceWindows();
  const deleteMutation = useDeleteMaintenanceWindow();

  const [editOpen, setEditOpen] = useState(false);
  const [editWindow, setEditWindow] = useState<MaintenanceWindowResponse | null>(null);
  const [filter, setFilter] = useState<FilterTab>("all");

  const handleDelete = (id: string, windowName: string) => {
    deleteMutation.mutate(id, {
      onSuccess: () => toast.success(`Deleted "${windowName}"`),
    });
  };

  const openEditDialog = (w: MaintenanceWindowResponse) => {
    setEditWindow(w);
    setEditOpen(true);
  };

  // Compute filtered list and summary counts
  const { filtered, counts } = useMemo(() => {
    const all = windows || [];
    const c = { all: all.length, active: 0, upcoming: 0, expired: 0 };
    for (const w of all) {
      c[getWindowStatus(w)]++;
    }
    const f =
      filter === "all" ? all : all.filter((w) => getWindowStatus(w) === filter);
    return { filtered: f, counts: c };
  }, [windows, filter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Maintenance Windows</h1>
        <CreateMaintenanceDialog />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard
          icon={<CalendarClock className="h-4 w-4 text-muted-foreground" />}
          label="Total"
          value={counts.all}
        />
        <SummaryCard
          icon={<Clock className="h-4 w-4 text-green-400" />}
          label="Active"
          value={counts.active}
        />
        <SummaryCard
          icon={<CalendarCheck className="h-4 w-4 text-blue-400" />}
          label="Upcoming"
          value={counts.upcoming}
        />
        <SummaryCard
          icon={<CalendarX className="h-4 w-4 text-zinc-400" />}
          label="Expired"
          value={counts.expired}
        />
      </div>

      {/* Filter Tabs */}
      <Tabs
        value={filter}
        onValueChange={(v) => setFilter(v as FilterTab)}
      >
        <TabsList>
          <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
          <TabsTrigger value="active">Active ({counts.active})</TabsTrigger>
          <TabsTrigger value="upcoming">
            Upcoming ({counts.upcoming})
          </TabsTrigger>
          <TabsTrigger value="expired">
            Expired ({counts.expired})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Table */}
      <MaintenanceTable
        windows={filtered}
        isLoading={isLoading}
        filter={filter}
        onEdit={openEditDialog}
        onDelete={handleDelete}
        isDeleting={deleteMutation.isPending}
      />

      {/* Edit Dialog */}
      <EditMaintenanceDialog
        window={editWindow}
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) setEditWindow(null);
        }}
      />
    </div>
  );
}
