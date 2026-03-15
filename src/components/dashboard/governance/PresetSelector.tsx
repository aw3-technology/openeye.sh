import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useGovernancePresets, useLoadPreset } from "@/hooks/useGovernanceQueries";
import { Package } from "lucide-react";

export function PresetSelector() {
  const { data: presets, isLoading } = useGovernancePresets();
  const loadPreset = useLoadPreset();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-4 w-4" />
          Presets
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && <p className="text-sm text-muted-foreground">Loading presets...</p>}
        <div className="flex flex-wrap gap-2">
          {(presets || []).map((preset) => (
            <Button
              key={preset}
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => loadPreset.mutate(preset)}
              disabled={loadPreset.isPending}
            >
              {preset}
            </Button>
          ))}
        </div>
        {!isLoading && (!presets || presets.length === 0) && (
          <p className="text-sm text-muted-foreground">No presets available.</p>
        )}
      </CardContent>
    </Card>
  );
}
