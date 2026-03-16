import { Brain, Loader2 } from "lucide-react";

export function SceneUnderstanding({
  vlmText,
  vlmTyping,
  vlmLatency,
  vlmPending,
}: {
  vlmText: string;
  vlmTyping: boolean;
  vlmLatency: number;
  vlmPending: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-[10px] text-amber-400 uppercase tracking-wider">
        <Brain className="h-3.5 w-3.5" />
        <span>Scene Understanding</span>
        {vlmLatency > 0 && (
          <span className="ml-auto text-white/30 tabular-nums">
            {vlmLatency.toFixed(0)}ms
          </span>
        )}
        {vlmPending && (
          <Loader2 className="ml-auto h-3 w-3 animate-spin text-amber-400/50" />
        )}
      </div>
      <div className="bg-white/5 rounded-md border border-white/10 p-3 min-h-[80px]">
        {vlmText ? (
          <p className="text-xs text-white/80 leading-relaxed whitespace-pre-wrap">
            {vlmText}
            {vlmTyping && (
              <span className="inline-block w-1.5 h-3.5 bg-amber-400 ml-0.5 animate-pulse" />
            )}
          </p>
        ) : (
          <p className="text-xs text-white/20 italic">
            Waiting for VLM reasoning...
          </p>
        )}
      </div>
    </div>
  );
}
