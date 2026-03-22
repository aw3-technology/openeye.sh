import { useState } from "react";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { useCreateMaintenanceWindow, useFleetGroups } from "@/hooks/useFleetQueries";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { RECURRENCE_OPTIONS } from "./constants";

export function CreateMaintenanceDialog() {
  const { data: groups } = useFleetGroups();
  const createMutation = useCreateMaintenanceWindow();

  const [open, setOpen] = useState(false);
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

  return (
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
  );
}
