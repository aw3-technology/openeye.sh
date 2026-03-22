import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  useMaintenanceWindows,
  useCreateMaintenanceWindow,
  useUpdateMaintenanceWindow,
  useDeleteMaintenanceWindow,
  useFleetGroups,
} from "@/hooks/useFleetQueries";
import {
  Plus,
  Pencil,
  Wrench,
  Trash2,
  Clock,
  CalendarClock,
  CalendarCheck,
  CalendarX,
  Repeat,
} from "lucide-react";
import { toast } from "sonner";
import type { MaintenanceWindowResponse } from "@/types/fleet";
import { formatDateRange } from "@/lib/format-utils";

type WindowStatus = "active" | "upcoming" | "expired";
type FilterTab = "all" | WindowStatus;

const RECURRENCE_OPTIONS = [
  { value: "", label: "One-time" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Bi-weekly" },
  { value: "monthly", label: "Monthly" },
];

function getWindowStatus(w: MaintenanceWindowResponse): WindowStatus {
  const now = Date.now();
  const start = new Date(w.starts_at).getTime();
  const end = new Date(w.ends_at).getTime();
  if (now >= start && now <= end) return "active";
  if (now < start) return "upcoming";
  return "expired";
}

const statusConfig: Record<
  WindowStatus,
  { label: string; className: string }
> = {
  active: {
    label: "Active",
    className: "bg-green-500/15 text-green-400 border-green-500/30",
  },
  upcoming: {
    label: "Upcoming",
    className: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  },
  expired: {
    label: "Expired",
    className: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
  },
};

export default function Maintenance() {
  const { data: windows, isLoading } = useMaintenanceWindows();
  const { data: groups } = useFleetGroups();
  const createMutation = useCreateMaintenanceWindow();
  const updateMutation = useUpdateMaintenanceWindow();
  const deleteMutation = useDeleteMaintenanceWindow();

  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editWindow, setEditWindow] = useState<MaintenanceWindowResponse | null>(null);
  const [editName, setEditName] = useState("");
  const [editStartsAt, setEditStartsAt] = useState("");
  const [editEndsAt, setEditEndsAt] = useState("");
  const [editRecurrence, setEditRecurrence] = useState("");
  const [filter, setFilter] = useState<FilterTab>("all");

  // Create form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [recurrence, setRecurrence] = useState("");
  const [groupId, setGroupId] = useState("");

  const resetForm = () => {
    setName("");
    setDescription("");
    setStartsAt("");
    setEndsAt("");
    setRecurrence("");
    setGroupId("");
  };

  const handleCreate = () => {
    const start = new Date(startsAt);
    const end = new Date(endsAt);
    if (start < new Date()) {
      toast.error("Start time must be in the future");
      return;
    }
    if (end <= start) {
      toast.error("End time must be after start time");
      return;
    }
    createMutation.mutate(
      {
        name,
        description: description || undefined,
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        recurrence: recurrence && recurrence !== "none" ? recurrence : undefined,
        group_id: groupId && groupId !== "none" ? groupId : undefined,
      },
      {
        onSuccess: () => {
          toast.success("Maintenance window created");
          setOpen(false);
          resetForm();
        },
      }
    );
  };

  const handleDelete = (id: string, windowName: string) => {
    deleteMutation.mutate(id, {
      onSuccess: () => toast.success(`Deleted "${windowName}"`),
    });
  };

  const openEditDialog = (w: MaintenanceWindowResponse) => {
    setEditWindow(w);
    setEditName(w.name);
    // Convert ISO to datetime-local format
    setEditStartsAt(w.starts_at.slice(0, 16));
    setEditEndsAt(w.ends_at.slice(0, 16));
    setEditRecurrence(w.recurrence || "");
    setEditOpen(true);
  };

  const handleEdit = () => {
    if (!editWindow) return;
    updateMutation.mutate(
      {
        id: editWindow.id,
        req: {
          name: editName,
          starts_at: new Date(editStartsAt).toISOString(),
          ends_at: new Date(editEndsAt).toISOString(),
          recurrence: editRecurrence && editRecurrence !== "none" ? editRecurrence : null,
        },
      },
      {
        onSuccess: () => {
          toast.success("Maintenance window updated");
          setEditOpen(false);
          setEditWindow(null);
        },
      }
    );
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
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" /> New Window
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Maintenance Window</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Nightly update window"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional details about this maintenance window"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Starts At</Label>
                  <Input
                    type="datetime-local"
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Ends At</Label>
                  <Input
                    type="datetime-local"
                    value={endsAt}
                    onChange={(e) => setEndsAt(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Recurrence</Label>
                  <Select value={recurrence} onValueChange={setRecurrence}>
                    <SelectTrigger>
                      <SelectValue placeholder="One-time" />
                    </SelectTrigger>
                    <SelectContent>
                      {RECURRENCE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value || "none"} value={opt.value || "none"}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Device Group</Label>
                  <Select value={groupId} onValueChange={setGroupId}>
                    <SelectTrigger>
                      <SelectValue placeholder="All devices" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">All devices</SelectItem>
                      {(groups || []).map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button
                className="w-full"
                disabled={
                  !name || !startsAt || !endsAt || createMutation.isPending
                }
                onClick={handleCreate}
              >
                {createMutation.isPending ? "Creating..." : "Create Window"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
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
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Starts</TableHead>
                <TableHead>Ends</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Recurrence</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center py-8 text-muted-foreground"
                  >
                    Loading...
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && filtered.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center py-8 text-muted-foreground"
                  >
                    {filter === "all"
                      ? "No maintenance windows scheduled"
                      : `No ${filter} maintenance windows`}
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((w) => {
                const status = getWindowStatus(w);
                const cfg = statusConfig[status];
                return (
                  <TableRow key={w.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Wrench className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div>
                          <div>{w.name}</div>
                          {w.description && (
                            <div className="text-xs text-muted-foreground max-w-xs truncate">
                              {w.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${cfg.className}`}
                      >
                        {cfg.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs tabular-nums">
                      {new Date(w.starts_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-xs tabular-nums">
                      {new Date(w.ends_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-xs tabular-nums text-muted-foreground">
                      {formatDateRange(w.starts_at, w.ends_at)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {w.recurrence ? (
                        <span className="inline-flex items-center gap-1">
                          <Repeat className="h-3 w-3" />
                          {w.recurrence}
                        </span>
                      ) : (
                        "One-time"
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => openEditDialog(w)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        disabled={deleteMutation.isPending}
                        onClick={() => handleDelete(w.id, w.name)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Maintenance Window Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Maintenance Window</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Starts At</Label>
                <Input
                  type="datetime-local"
                  value={editStartsAt}
                  onChange={(e) => setEditStartsAt(e.target.value)}
                />
              </div>
              <div>
                <Label>Ends At</Label>
                <Input
                  type="datetime-local"
                  value={editEndsAt}
                  onChange={(e) => setEditEndsAt(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label>Recurrence</Label>
              <Select value={editRecurrence || "none"} onValueChange={setEditRecurrence}>
                <SelectTrigger>
                  <SelectValue placeholder="One-time" />
                </SelectTrigger>
                <SelectContent>
                  {RECURRENCE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value || "none"} value={opt.value || "none"}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full"
              disabled={!editName || !editStartsAt || !editEndsAt || updateMutation.isPending}
              onClick={handleEdit}
            >
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        {icon}
        <div>
          <p className="text-2xl font-semibold tabular-nums">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
