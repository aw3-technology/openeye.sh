import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DeviceStatusBadge } from "@/components/fleet/DeviceStatusBadge";
import {
  useGroupMembers,
  useAddGroupMember,
  useRemoveGroupMember,
  useFleetDevices,
} from "@/hooks/useFleetQueries";
import { Plus, UserPlus, UserMinus } from "lucide-react";
import { toast } from "sonner";

export function GroupMembersPanel({ groupId }: { groupId: string }) {
  const { data: members, isLoading } = useGroupMembers(groupId);
  const { data: allDevices } = useFleetDevices();
  const addMutation = useAddGroupMember();
  const removeMutation = useRemoveGroupMember();

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [search, setSearch] = useState("");

  const memberIds = useMemo(() => new Set((members || []).map((m) => m.id)), [members]);
  const available = useMemo(
    () =>
      (allDevices || []).filter(
        (d) =>
          !memberIds.has(d.id) &&
          d.status !== "decommissioned" &&
          (d.name.toLowerCase().includes(search.toLowerCase()) ||
            d.device_type.toLowerCase().includes(search.toLowerCase())),
      ),
    [allDevices, memberIds, search],
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
