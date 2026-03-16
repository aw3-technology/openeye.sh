import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Brain, Loader2 } from "lucide-react";
import { formatTimeAgo } from "./utils";
import type { AgenticFrame } from "./types";

interface VLMReasoningPanelProps {
  latestFrame: AgenticFrame | null;
  running: boolean;
}

export function VLMReasoningPanel({ latestFrame, running }: VLMReasoningPanelProps) {
  return (
    <Card className="border-terminal-amber/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-mono flex items-center gap-2 text-terminal-amber">
          <Brain className="h-4 w-4" />
          VLM REASONING
          {latestFrame?.vlm_reasoning?.latency_ms ? (
            <Badge variant="outline" className="ml-auto text-[10px] border-terminal-amber/30">
              {latestFrame.vlm_reasoning.latency_ms.toFixed(0)}ms
            </Badge>
          ) : running ? (
            <Loader2 className="ml-auto h-3 w-3 animate-spin text-terminal-amber/50" />
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {latestFrame?.vlm_reasoning?.description &&
        !latestFrame.vlm_reasoning.description.startsWith("VLM not configured") ? (
          <motion.div
            key={latestFrame.vlm_reasoning.description.slice(0, 20)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-2"
          >
            <p className="text-sm leading-relaxed">{latestFrame.vlm_reasoning.description}</p>
            <p className="text-[10px] font-mono text-muted-foreground">
              {latestFrame.vlm_reasoning.reasoning}
            </p>
          </motion.div>
        ) : (
          <p className="text-xs text-muted-foreground font-mono py-4 text-center">
            {running
              ? "VLM reasoning runs every 3s..."
              : "Start agent for VLM analysis"}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

interface VLMHistoryPanelProps {
  vlmHistory: Array<{ timestamp: number; description: string }>;
}

export function VLMHistoryPanel({ vlmHistory }: VLMHistoryPanelProps) {
  if (vlmHistory.length === 0) return null;

  return (
    <Card className="border-terminal-amber/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-mono flex items-center gap-2 text-terminal-amber">
          <Brain className="h-4 w-4" />
          REASONING HISTORY
          <Badge variant="outline" className="ml-auto text-[10px] border-terminal-amber/30">
            {vlmHistory.length} calls
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-40">
          <div className="space-y-2">
            {vlmHistory.slice(0, 8).map((entry, i) => (
              <div
                key={`${entry.timestamp}-${i}`}
                className="text-xs text-muted-foreground border-l-2 border-terminal-amber/20 pl-2 py-1"
              >
                <span className="font-mono text-[10px] text-terminal-amber/60 block">
                  {formatTimeAgo(entry.timestamp)}
                </span>
                <span className="line-clamp-2">{entry.description}</span>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
