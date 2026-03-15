import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DeviceStatusBadge } from "@/components/fleet/DeviceStatusBadge";
import {
  useFleetGroups,
  useCreateGroup,
  useDeleteGroup,
  useGroupMembers,
  useAddGroupMember,
  useRemoveGroupMember,
  useSetScalingPolicy,
  useFleetDevices,
} from "@/hooks/useFleetQueries";
import type { DeviceGroupResponse, AutoScalingPolicy } from "@/types/fleet";
import {
  Plus,
  Users,
  Trash2,
  Settings2,
  ChevronRight,
  ArrowLeft,
  UserPlus,
  UserMinus,
  Tag,
  Scaling,
} from "lucide-react";
import { toast } from "sonner";

// ── Default scaling policy values ───────────────────────────────
const DEFAULT_POLICY: AutoScalingPolicy = {
  enabled: false,
  min_devices: 1,
  max_devices: 10,
  target_cpu_percent: 70,
  scale_up_threshold: 80,
  scale_down_threshold: 30,
  cooldown_seconds: 300,
};

// ── Main Page ───────────────────────────────────────────────────
export default function DeviceGroups() {
  const { data: groups, isLoading } = useFleetGroups();
  const [selectedGroup, setSelectedGroup] = useState<DeviceGroupResponse | null>(null);

  if (selectedGroup) {
    return <GroupDetail group={selectedGroup} onBack={() => setSelectedGroup(null)} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Device Groups</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Organize devices into logical groups for batch operations and auto-scaling
          </p>
        </div>
        <CreateGroupDialog />
      </div>

      {/* Summary cards */}
      {groups && groups.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total Groups</p>
              <p className="text-2xl font-semibold tabular-nums">{groups.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total Devices</p>
              <p className="text-2xl font-semibold tabular-nums">
                {groups.reduce((sum, g) => sum + g.device_count, 0)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Auto-Scaling Active</p>
              <p className="text-2xl font-semibold tabular-nums">
                {groups.filter((g) => g.auto_scaling_policy?.enabled).length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">With Tag Filters</p>
              <p className="text-2xl font-semibold tabular-nums">
                {groups.filter((g) => Object.keys(g.tag_filter || {}).length > 0).length}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Groups table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Devices</TableHead>
                <TableHead>Tag Filter</TableHead>
                <TableHead>Auto-Scaling</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && (!groups || groups.length === 0) && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p>No device groups yet</p>
                    <p className="text-xs mt-1">Create a group to organize your fleet devices</p>
                  </TableCell>
                </TableRow>
              )}
              {(groups || []).map((g) => (
                <TableRow
                  key={g.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setSelectedGroup(g)}
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      {g.name}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-48 truncate">
                    {g.description || "—"}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm font-medium tabular-nums">{g.device_count}</span>
                  </TableCell>
                  <TableCell>
                    <TagFilterBadges filter={g.tag_filter} />
                  </TableCell>
                  <TableCell>
                    {g.auto_scaling_policy?.enabled ? (
                      <span className="inline-flex items-center rounded-full border border-teal-500/30 bg-teal-500/15 px-2 py-0.5 text-xs font-medium text-teal-400">
                        <Scaling className="h-3 w-3 mr-1" />
                        {g.auto_scaling_policy.min_devices}–{g.auto_scaling_policy.max_devices}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Off</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground tabular-nums">
                    {new Date(g.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Tag Filter Badges ───────────────────────────────────────────
function TagFilterBadges({ filter }: { filter?: Record<string, string> }) {
  const entries = Object.entries(filter || {});
  if (entries.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {entries.slice(0, 3).map(([k, v]) => (
        <Badge key={k} variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
          {k}={v}
        </Badge>
      ))}
      {entries.length > 3 && (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
          +{entries.length - 3}
        </Badge>
      )}
    </div>
  );
}

// ── Create Group Dialog ─────────────────────────────────────────
function CreateGroupDialog() {
  const createMutation = useCreateGroup();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tagKey, setTagKey] = useState("");
  const [tagValue, setTagValue] = useState("");
  const [tagFilter, setTagFilter] = useState<Record<string, string>>({});

  const addTag = () => {
    const k = tagKey.trim();
    const v = tagValue.trim();
    if (!k) return;
    setTagFilter((prev) => ({ ...prev, [k]: v }));
    setTagKey("");
    setTagValue("");
  };

  const removeTag = (key: string) => {
    setTagFilter((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleCreate = () => {
    createMutation.mutate(
      {
        name,
        description: description || undefined,
        tag_filter: Object.keys(tagFilter).length > 0 ? tagFilter : undefined,
      },
      {
        onSuccess: () => {
          toast.success("Group created");
          setOpen(false);
          setName("");
          setDescription("");
          setTagFilter({});
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" /> Create Group
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Device Group</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Group Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. warehouse-floor-1"
            />
          </div>
          <div>
            <Label>Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
            />
          </div>

          {/* Tag filter */}
          <div>
            <Label className="flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5" /> Tag Filter
            </Label>
            <p className="text-xs text-muted-foreground mb-2">
              Devices matching these tags will auto-join this group
            </p>
            <div className="flex gap-2">
              <Input
                className="flex-1"
                value={tagKey}
                onChange={(e) => setTagKey(e.target.value)}
                placeholder="Key"
                onKeyDown={(e) => e.key === "Enter" && addTag()}
              />
              <Input
                className="flex-1"
                value={tagValue}
                onChange={(e) => setTagValue(e.target.value)}
                placeholder="Value"
                onKeyDown={(e) => e.key === "Enter" && addTag()}
              />
              <Button type="button" variant="outline" size="sm" onClick={addTag} disabled={!tagKey.trim()}>
                Add
              </Button>
            </div>
            {Object.keys(tagFilter).length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {Object.entries(tagFilter).map(([k, v]) => (
                  <Badge
                    key={k}
                    variant="secondary"
                    className="text-xs cursor-pointer hover:bg-destructive/20"
                    onClick={() => removeTag(k)}
                  >
                    {k}={v} &times;
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <Button
            className="w-full"
            disabled={!name.trim() || createMutation.isPending}
            onClick={handleCreate}
          >
            {createMutation.isPending ? "Creating..." : "Create Group"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Group Detail View ───────────────────────────────────────────
function GroupDetail({
  group,
  onBack,
}: {
  group: DeviceGroupResponse;
  onBack: () => void;
}) {
  const { data: latestGroup } = useFleetGroups();
  const live = latestGroup?.find((g) => g.id === group.id) ?? group;

  const deleteMutation = useDeleteGroup();
  const [showScaling, setShowScaling] = useState(false);

  const handleDelete = () => {
    if (!window.confirm(`Delete group "${live.name}"? This cannot be undone.`)) return;
    deleteMutation.mutate(live.id, {
      onSuccess: () => {
        toast.success("Group deleted");
        onBack();
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">{live.name}</h1>
          <p className="text-sm text-muted-foreground">
            {live.description || "No description"} &middot; {live.device_count} device
            {live.device_count !== 1 ? "s" : ""}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowScaling(true)}>
          <Settings2 className="h-4 w-4 mr-1" /> Scaling Policy
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={handleDelete}
          disabled={deleteMutation.isPending}
        >
          <Trash2 className="h-4 w-4 mr-1" /> Delete
        </Button>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Devices</p>
            <p className="text-2xl font-semibold tabular-nums">{live.device_count}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Auto-Scaling</p>
            <p className="text-sm font-medium mt-1">
              {live.auto_scaling_policy?.enabled ? (
                <span className="text-teal-400">
                  Enabled ({live.auto_scaling_policy.min_devices}–{live.auto_scaling_policy.max_devices})
                </span>
              ) : (
                <span className="text-muted-foreground">Disabled</span>
              )}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Tag Filters</p>
            <div className="mt-1">
              <TagFilterBadges filter={live.tag_filter} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Created</p>
            <p className="text-sm font-medium">{new Date(live.created_at).toLocaleDateString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs: Members / Scaling Details */}
      <Tabs defaultValue="members">
        <TabsList>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="scaling">Scaling Config</TabsTrigger>
        </TabsList>

        <TabsContent value="members">
          <GroupMembersPanel groupId={live.id} />
        </TabsContent>

        <TabsContent value="scaling">
          <ScalingDetailsCard group={live} />
        </TabsContent>
      </Tabs>

      {/* Scaling Policy Dialog */}
      {showScaling && (
        <ScalingPolicyDialog
          group={live}
          open={showScaling}
          onOpenChange={setShowScaling}
        />
      )}
    </div>
  );
}

// ── Group Members Panel ─────────────────────────────────────────
function GroupMembersPanel({ groupId }: { groupId: string }) {
  const { data: members, isLoading } = useGroupMembers(groupId);
  const { data: allDevices } = useFleetDevices();
  const addMutation = useAddGroupMember();
  const removeMutation = useRemoveGroupMember();

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [search, setSearch] = useState("");

  const memberIds = new Set((members || []).map((m) => m.id));
  const available = (allDevices || []).filter(
    (d) =>
      !memberIds.has(d.id) &&
      d.status !== "decommissioned" &&
      (d.name.toLowerCase().includes(search.toLowerCase()) ||
        d.device_type.toLowerCase().includes(search.toLowerCase())),
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-sm">Group Members</CardTitle>
        <Button size="sm" variant="outline" onClick={() => setShowAddDialog(true)}>
          <UserPlus className="h-4 w-4 mr-1" /> Add Device
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Device</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>IP</TableHead>
              <TableHead>Last Heartbeat</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Loading members...
                </TableCell>
              </TableRow>
            )}
            {!isLoading && (!members || members.length === 0) && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No devices in this group
                </TableCell>
              </TableRow>
            )}
            {(members || []).map((device) => (
              <TableRow key={device.id}>
                <TableCell className="font-medium">{device.name}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{device.device_type}</TableCell>
                <TableCell>
                  <DeviceStatusBadge status={device.status} />
                </TableCell>
                <TableCell className="text-xs tabular-nums text-muted-foreground">
                  {device.ip_address || "—"}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {device.last_heartbeat_at
                    ? new Date(device.last_heartbeat_at).toLocaleString()
                    : "Never"}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    disabled={removeMutation.isPending}
                    onClick={() =>
                      removeMutation.mutate(
                        { groupId, deviceId: device.id },
                        { onSuccess: () => toast.success(`Removed ${device.name}`) },
                      )
                    }
                  >
                    <UserMinus className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      {/* Add Device Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Device to Group</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Search devices..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="max-h-64 overflow-y-auto space-y-1">
              {available.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {allDevices ? "No available devices" : "Loading devices..."}
                </p>
              )}
              {available.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between p-2 rounded hover:bg-muted/50"
                >
                  <div>
                    <p className="text-sm font-medium">{d.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {d.device_type} &middot; {d.status}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={addMutation.isPending}
                    onClick={() =>
                      addMutation.mutate(
                        { groupId, deviceId: d.id },
                        {
                          onSuccess: () => {
                            toast.success(`Added ${d.name}`);
                          },
                        },
                      )
                    }
                  >
                    <Plus className="h-3 w-3 mr-1" /> Add
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ── Scaling Details Card ────────────────────────────────────────
function ScalingDetailsCard({ group }: { group: DeviceGroupResponse }) {
  const policy = group.auto_scaling_policy;

  if (!policy || !policy.enabled) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Scaling className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p>Auto-scaling is not configured for this group</p>
          <p className="text-xs mt-1">
            Use the "Scaling Policy" button above to enable it
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Scaling className="h-4 w-4" /> Auto-Scaling Configuration
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Status</p>
            <p className="font-medium text-teal-400">Enabled</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Device Range</p>
            <p className="font-medium tabular-nums">
              {policy.min_devices} – {policy.max_devices}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Target CPU</p>
            <p className="font-medium tabular-nums">{policy.target_cpu_percent}%</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Scale Up Threshold</p>
            <p className="font-medium tabular-nums">{policy.scale_up_threshold}%</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Scale Down Threshold</p>
            <p className="font-medium tabular-nums">{policy.scale_down_threshold}%</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Cooldown</p>
            <p className="font-medium tabular-nums">{policy.cooldown_seconds}s</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Scaling Policy Dialog ───────────────────────────────────────
function ScalingPolicyDialog({
  group,
  open,
  onOpenChange,
}: {
  group: DeviceGroupResponse;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const scalingMutation = useSetScalingPolicy();
  const existing = group.auto_scaling_policy;

  const [enabled, setEnabled] = useState(existing?.enabled ?? false);
  const [minDevices, setMinDevices] = useState(String(existing?.min_devices ?? DEFAULT_POLICY.min_devices));
  const [maxDevices, setMaxDevices] = useState(String(existing?.max_devices ?? DEFAULT_POLICY.max_devices));
  const [targetCpu, setTargetCpu] = useState(String(existing?.target_cpu_percent ?? DEFAULT_POLICY.target_cpu_percent));
  const [scaleUp, setScaleUp] = useState(String(existing?.scale_up_threshold ?? DEFAULT_POLICY.scale_up_threshold));
  const [scaleDown, setScaleDown] = useState(String(existing?.scale_down_threshold ?? DEFAULT_POLICY.scale_down_threshold));
  const [cooldown, setCooldown] = useState(String(existing?.cooldown_seconds ?? DEFAULT_POLICY.cooldown_seconds));

  const handleSave = () => {
    const policy: AutoScalingPolicy = {
      enabled,
      min_devices: Number(minDevices),
      max_devices: Number(maxDevices),
      target_cpu_percent: Number(targetCpu),
      scale_up_threshold: Number(scaleUp),
      scale_down_threshold: Number(scaleDown),
      cooldown_seconds: Number(cooldown),
    };

    if (policy.min_devices > policy.max_devices) {
      toast.error("Min devices cannot exceed max devices");
      return;
    }
    if (policy.scale_down_threshold >= policy.scale_up_threshold) {
      toast.error("Scale-down threshold must be less than scale-up threshold");
      return;
    }

    scalingMutation.mutate(
      { groupId: group.id, policy },
      {
        onSuccess: () => {
          toast.success("Scaling policy updated");
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Auto-Scaling Policy — {group.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Enable Auto-Scaling</Label>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Min Devices</Label>
              <Input
                type="number"
                min={1}
                value={minDevices}
                onChange={(e) => setMinDevices(e.target.value)}
                disabled={!enabled}
              />
            </div>
            <div>
              <Label className="text-xs">Max Devices</Label>
              <Input
                type="number"
                min={1}
                value={maxDevices}
                onChange={(e) => setMaxDevices(e.target.value)}
                disabled={!enabled}
              />
            </div>
          </div>

          <div>
            <Label className="text-xs">Target CPU %</Label>
            <Input
              type="number"
              min={1}
              max={100}
              value={targetCpu}
              onChange={(e) => setTargetCpu(e.target.value)}
              disabled={!enabled}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Scale Up Threshold %</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={scaleUp}
                onChange={(e) => setScaleUp(e.target.value)}
                disabled={!enabled}
              />
            </div>
            <div>
              <Label className="text-xs">Scale Down Threshold %</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={scaleDown}
                onChange={(e) => setScaleDown(e.target.value)}
                disabled={!enabled}
              />
            </div>
          </div>

          <div>
            <Label className="text-xs">Cooldown (seconds)</Label>
            <Input
              type="number"
              min={0}
              value={cooldown}
              onChange={(e) => setCooldown(e.target.value)}
              disabled={!enabled}
            />
          </div>

          <Button
            className="w-full"
            disabled={scalingMutation.isPending}
            onClick={handleSave}
          >
            {scalingMutation.isPending ? "Saving..." : "Save Policy"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
