import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateGroup } from "@/hooks/useFleetQueries";
import { Plus, Tag } from "lucide-react";
import { toast } from "sonner";

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
