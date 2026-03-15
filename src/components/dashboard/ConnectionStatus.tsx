import { useOpenEyeConnection } from "@/hooks/useOpenEyeConnection";

export function ConnectionStatus() {
  const { isConnected, healthData, serverUrl } = useOpenEyeConnection();

  return (
    <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground" role="status" aria-label={isConnected ? "Server connected" : "Server disconnected"}>
      <span
        className={`h-2 w-2 rounded-full ${isConnected ? "bg-terminal-green" : "bg-destructive"}`}
        aria-hidden="true"
      />
      <span className="hidden sm:inline">
        {isConnected
          ? `${healthData?.model || "connected"} — ${serverUrl}`
          : "disconnected"}
      </span>
      <span className="sr-only sm:hidden">{isConnected ? "Connected" : "Disconnected"}</span>
    </div>
  );
}
