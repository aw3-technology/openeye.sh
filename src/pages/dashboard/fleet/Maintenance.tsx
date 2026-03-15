import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMaintenanceWindows, useCreateMaintenanceWindow } from "@/hooks/useFleetQueries";
import { Plus, Wrench } from "lucide-react";
import { toast } from "sonner";

export default function Maintenance() {
  const { data: windows, isLoading } = useMaintenanceWindows();
  const createMutation = useCreateMaintenanceWindow();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");

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
    createMutation.mutate({
      name,
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
    }, {
      onSuccess: () => {
        toast.success("Maintenance window created");
        setOpen(false);
        setName("");
        setStartsAt("");
        setEndsAt("");
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Maintenance Windows</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New Window</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Maintenance Window</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Nightly update window" />
              </div>
              <div>
                <Label>Starts At</Label>
                <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
              </div>
              <div>
                <Label>Ends At</Label>
                <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
              </div>
              <Button className="w-full" disabled={!name || !startsAt || !endsAt || createMutation.isPending} onClick={handleCreate}>
                {createMutation.isPending ? "Creating..." : "Create"}
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
                <TableHead>Starts</TableHead>
                <TableHead>Ends</TableHead>
                <TableHead>Active</TableHead>
                <TableHead>Recurrence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              )}
              {!isLoading && (!windows || windows.length === 0) && (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No maintenance windows</TableCell></TableRow>
              )}
              {(windows || []).map((w) => (
                <TableRow key={w.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Wrench className="h-4 w-4 text-muted-foreground" />
                      {w.name}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs tabular-nums">{new Date(w.starts_at).toLocaleString()}</TableCell>
                  <TableCell className="text-xs tabular-nums">{new Date(w.ends_at).toLocaleString()}</TableCell>
                  <TableCell>
                    <span className={`text-xs font-medium ${w.is_active ? "text-green-400" : "text-muted-foreground"}`}>
                      {w.is_active ? "Active" : "Inactive"}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{w.recurrence || "One-time"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
