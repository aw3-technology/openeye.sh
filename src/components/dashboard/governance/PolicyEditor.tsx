import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useGovernanceConfig, useUpdateGovernanceConfig } from "@/hooks/useGovernanceQueries";
import { FileCode, Save } from "lucide-react";

export function PolicyEditor() {
  const { data: configData, isLoading } = useGovernanceConfig();
  const updateConfig = useUpdateGovernanceConfig();
  const [yaml, setYaml] = useState("");

  useEffect(() => {
    if (configData?.yaml) {
      setYaml(configData.yaml);
    }
  }, [configData?.yaml]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <FileCode className="h-4 w-4" />
          Policy Editor
        </CardTitle>
        <Button
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={() => updateConfig.mutate(yaml)}
          disabled={updateConfig.isPending || yaml === configData?.yaml}
        >
          <Save className="h-3 w-3" />
          Apply
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading config...</p>
        ) : (
          <textarea
            className="h-80 w-full rounded-md border border-border bg-muted/30 p-3 font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            value={yaml}
            onChange={(e) => setYaml(e.target.value)}
            spellCheck={false}
          />
        )}
      </CardContent>
    </Card>
  );
}
