import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useFleetGroups, useCreateGroup } from "@/hooks/useFleetQueries";
import { Plus, Users } from "lucide-react";
import { toast } from "sonner";

export default function DeviceGroups() {
  const { data: groups, isLoading } = useFleetGroups();
  const createMutation = useCreateGroup();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const handleCreate = () => {
    createMutation.mutate({ name, description }, {
      onSuccess: () => {
        toast.success("Group created");
        setOpen(false);
        setName("");
        setDescription("");
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Device Groups</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Create Group</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Device Group</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Group Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. warehouse-floor-1" />
              </div>
              <div>
                <Label>Description</Label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" />
              </div>
              <Button className="w-full" disabled={!name.trim() || createMutation.isPending} onClick={handleCreate}>
                {createMutation.isPending ? "Creating..." : "Create Group"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Devices</TableHead>
                <TableHead>Scaling</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              )}
              {!isLoading && (!groups || groups.length === 0) && (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No groups yet</TableCell></TableRow>
              )}
              {(groups || []).map((g) => (
                <TableRow key={g.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      {g.name}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{g.description || "—"}</TableCell>
                  <TableCell className="text-sm tabular-nums">{g.device_count}</TableCell>
                  <TableCell className="text-xs">
                    {g.auto_scaling_policy?.enabled ? (
                      <span className="text-teal-400">Enabled ({g.auto_scaling_policy.min_devices}-{g.auto_scaling_policy.max_devices})</span>
                    ) : (
                      <span className="text-muted-foreground">Off</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground tabular-nums">
                    {new Date(g.created_at).toLocaleDateString()}
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
