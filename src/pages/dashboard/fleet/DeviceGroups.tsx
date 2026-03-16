import { useState } from "react";
import { useFleetGroups } from "@/hooks/useFleetQueries";
import { GroupList } from "@/components/fleet/device-groups/GroupList";
import { GroupDetail } from "@/components/fleet/device-groups/GroupDetail";
import { CreateGroupDialog } from "@/components/fleet/device-groups/GroupActions";
import type { DeviceGroupResponse } from "@/types/fleet";

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

      <GroupList groups={groups} isLoading={isLoading} onSelectGroup={setSelectedGroup} />
    </div>
  );
}
