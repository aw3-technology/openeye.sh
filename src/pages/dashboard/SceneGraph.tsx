import { useState } from "react";
import { useOpenEyeStream } from "@/hooks/useOpenEyeStream";
import { LiveSceneGraph } from "@/components/dashboard/LiveSceneGraph";
import { useInferenceHistory } from "@/hooks/useOpenEyeQueries";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Play, Square } from "lucide-react";
import { toast } from "sonner";
import type { DetectedObject } from "@/types/openeye";

function SceneGraphInner() {
  const { isStreaming, startStream, stopStream, latestResult } = useOpenEyeStream();

  const handleStart = async () => {
    try {
      await startStream();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start camera");
    }
  };
  const { data: historyData } = useInferenceHistory(0, 10);
  const [selectedHistoryIdx, setSelectedHistoryIdx] = useState<number | null>(null);

  const rows = historyData?.data || [];
  let historyObjects: DetectedObject[] = [];
  if (selectedHistoryIdx !== null && rows[selectedHistoryIdx]) {
    try {
      historyObjects = JSON.parse(rows[selectedHistoryIdx].objects_json);
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Scene Graph</h1>

      <Tabs defaultValue="live">
        <TabsList>
          <TabsTrigger value="live">Live Stream</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="live" className="space-y-4 mt-4">
          <Button
            onClick={isStreaming ? stopStream : handleStart}
            variant={isStreaming ? "destructive" : "default"}
            className="gap-2"
          >
            {isStreaming ? (
              <>
                <Square className="h-4 w-4" />
                Stop
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Start Camera
              </>
            )}
          </Button>

          <LiveSceneGraph objects={latestResult?.objects || []} />
        </TabsContent>

        <TabsContent value="history" className="space-y-4 mt-4">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No inference history available.</p>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Select a result</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  {rows.map((row, idx) => (
                    <button
                      key={row.id}
                      onClick={() => setSelectedHistoryIdx(idx)}
                      className={`w-full text-left px-3 py-2 rounded-md text-xs font-mono transition-colors ${
                        selectedHistoryIdx === idx
                          ? "bg-primary/10 text-primary"
                          : "hover:bg-muted"
                      }`}
                    >
                      {row.model} — {row.object_count} objects — {row.inference_ms.toFixed(0)}ms
                    </button>
                  ))}
                </CardContent>
              </Card>

              <LiveSceneGraph objects={historyObjects} />
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function SceneGraphPage() {
  return <SceneGraphInner />;
}
