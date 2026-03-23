import {
  PerceptionStreamProvider,
  usePerceptionStream,
} from "@/hooks/usePerceptionStream";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Play,
  Square,
  GitBranch,
  Eye,
} from "lucide-react";
import { toast } from "sonner";

import { LiveTabContent } from "@/pages/dashboard/scene-graph/LiveTab";
import { HistoryTabContent } from "@/pages/dashboard/scene-graph/HistoryTab";

/* ------------------------------------------------------------------ */
/*  Main Page                                                           */
/* ------------------------------------------------------------------ */

function SceneGraphInner() {
  const { isStreaming, startStream, stopStream, mode } = usePerceptionStream();

  const handleStart = async () => {
    try {
      await startStream();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start camera");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">Scene Graph</h1>
          {isStreaming && (
            <Badge
              variant="outline"
              className="text-[10px] font-mono border-terminal-green/30 text-terminal-green animate-pulse"
            >
              LIVE
            </Badge>
          )}
          {mode === "replay" && (
            <Badge
              variant="outline"
              className="text-[10px] font-mono border-terminal-amber/30 text-terminal-amber"
            >
              REPLAY
            </Badge>
          )}
        </div>
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
      </div>

      {/* Tabs */}
      <Tabs defaultValue="live">
        <TabsList>
          <TabsTrigger value="live">
            <GitBranch className="h-3.5 w-3.5 mr-1.5" />
            Live
          </TabsTrigger>
          <TabsTrigger value="history">
            <Eye className="h-3.5 w-3.5 mr-1.5" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="live" className="mt-4">
          <LiveTabContent />
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <HistoryTabContent />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function SceneGraphPage() {
  return (
    <PerceptionStreamProvider>
      <SceneGraphInner />
    </PerceptionStreamProvider>
  );
}
