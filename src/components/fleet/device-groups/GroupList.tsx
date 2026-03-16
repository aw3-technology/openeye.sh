import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TagFilterBadges } from "./TagFilterBadges";
import type { DeviceGroupResponse } from "@/types/fleet";
import { Users, ChevronRight, Scaling } from "lucide-react";

function SummaryCards({ groups }: { groups: DeviceGroupResponse[] }) {
  return (
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
  );
}

export function GroupList({
  groups,
  isLoading,
  onSelectGroup,
}: {
  groups: DeviceGroupResponse[] | undefined;
  isLoading: boolean;
  onSelectGroup: (group: DeviceGroupResponse) => void;
}) {
  return (
    <>
      {groups && groups.length > 0 && <SummaryCards groups={groups} />}

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
                  onClick={() => onSelectGroup(g)}
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
    </>
  );
}
