import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useCreateGroup, useSetScalingPolicy } from "@/hooks/useFleetQueries";
import type { DeviceGroupResponse, AutoScalingPolicy } from "@/types/fleet";
import { Plus, Tag } from "lucide-react";
import { toast } from "sonner";

const DEFAULT_POLICY: AutoScalingPolicy = {
  enabled: false,
  min_devices: 1,
  max_devices: 10,
  target_cpu_percent: 70,
  scale_up_threshold: 80,
  scale_down_threshold: 30,
  cooldown_seconds: 300,
};

// ── Create Group Dialog ─────────────────────────────────────────

export function CreateGroupDialog() {
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

// ── Scaling Policy Dialog ───────────────────────────────────────

export function ScalingPolicyDialog({
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
