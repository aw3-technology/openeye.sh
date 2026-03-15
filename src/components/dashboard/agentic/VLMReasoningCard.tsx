import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, Loader2 } from "lucide-react";
import type { AgenticFrame } from "@/types/agentic";

interface VLMReasoningCardProps {
  frame: AgenticFrame | null;
  running: boolean;
}

export function VLMReasoningCard({ frame, running }: VLMReasoningCardProps) {
  return (
    <Card className="border-terminal-amber/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-mono flex items-center gap-2 text-terminal-amber">
          <Brain className="h-4 w-4" />
          VLM REASONING
          {frame?.vlm_reasoning?.latency_ms ? (
            <Badge variant="outline" className="ml-auto text-[10px] border-terminal-amber/30">
              {frame.vlm_reasoning.latency_ms.toFixed(0)}ms
            </Badge>
          ) : running ? (
            <Loader2 className="ml-auto h-3 w-3 animate-spin text-terminal-amber/50" />
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {frame?.vlm_reasoning?.description &&
        !frame.vlm_reasoning.description.startsWith("VLM not configured") ? (
          <motion.div
            key={frame.vlm_reasoning.description.slice(0, 20)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-2"
          >
            <p className="text-sm leading-relaxed">{frame.vlm_reasoning.description}</p>
            <p className="text-[10px] font-mono text-muted-foreground">
              {frame.vlm_reasoning.reasoning}
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
