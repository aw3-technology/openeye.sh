import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TagFilterBadges } from "./TagFilterBadges";
import { GroupMembersPanel } from "./GroupMembersPanel";
import { ScalingPolicyDialog } from "./GroupActions";
import { useFleetGroups, useDeleteGroup } from "@/hooks/useFleetQueries";
import type { DeviceGroupResponse } from "@/types/fleet";
import { Trash2, Settings2, ArrowLeft, Scaling } from "lucide-react";
import { toast } from "sonner";

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

export function GroupDetail({
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
