import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Plus } from "lucide-react";

interface TagEditorProps {
  tags: Record<string, string>;
  onChange: (tags: Record<string, string>) => void;
  disabled?: boolean;
}

export function TagEditor({ tags, onChange, disabled }: TagEditorProps) {
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");

  const entries = Object.entries(tags);

  const tagKeyRegex = /^[a-zA-Z0-9_.\-/]{1,128}$/;

  const handleAdd = () => {
    const key = newKey.trim();
    const value = newValue.trim();
    if (!key || !tagKeyRegex.test(key)) return;
    if (value.length > 256) return;
    onChange({ ...tags, [key]: value });
    setNewKey("");
    setNewValue("");
  };

  const handleRemove = (key: string) => {
    const next = { ...tags };
    delete next[key];
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {entries.map(([k, v]) => (
          <span
            key={k}
            className="inline-flex items-center gap-1 rounded-md border bg-muted/50 px-2 py-1 text-xs"
          >
            <span className="font-medium">{k}</span>
            <span className="text-muted-foreground">=</span>
            <span>{v}</span>
            {!disabled && (
              <button onClick={() => handleRemove(k)} className="ml-1 hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        ))}
        {entries.length === 0 && <span className="text-xs text-muted-foreground">No tags</span>}
      </div>
      {!disabled && (
        <div className="flex gap-2">
          <Input
            placeholder="Key"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            className="h-8 w-28 text-xs"
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
          <Input
            placeholder="Value"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            className="h-8 w-28 text-xs"
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
          <Button size="sm" variant="outline" onClick={handleAdd} className="h-8">
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}
