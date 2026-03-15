/** Hook for agent loop streaming — demo mode or live SSE. */

import { useState, useCallback, useRef, useEffect } from "react";
import { agentDemoTicks } from "@/data/agentDemoData";
import type { AgentTickEvent, Observation } from "@/types/agent";

type Mode = "demo" | "live";

interface UseAgentStreamReturn {
  ticks: AgentTickEvent[];
  currentTick: AgentTickEvent | null;
  plan: string[];
  isRunning: boolean;
  memories: Observation[];
  startAgent: (mode?: Mode) => void;
  stopAgent: () => void;
  mode: Mode;
}

export function useAgentStream(serverUrl = ""): UseAgentStreamReturn {
  const [ticks, setTicks] = useState<AgentTickEvent[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [mode, setMode] = useState<Mode>("demo");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const demoIndexRef = useRef(0);
  const eventSourceRef = useRef<EventSource | null>(null);

  const stopAgent = useCallback(() => {
    setIsRunning(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (mode === "live" && serverUrl) {
      fetch(`${serverUrl}/agent/stop`, { method: "POST" }).catch(() => {});
    }
  }, [mode, serverUrl]);

  const startDemo = useCallback(() => {
    setTicks([]);
    demoIndexRef.current = 0;
    setIsRunning(true);

    intervalRef.current = setInterval(() => {
      const idx = demoIndexRef.current;
      if (idx >= agentDemoTicks.length) {
        setIsRunning(false);
        if (intervalRef.current) clearInterval(intervalRef.current);
        return;
      }
      setTicks((prev) => [...prev, agentDemoTicks[idx]]);
      demoIndexRef.current++;
    }, 2000);
  }, []);

  const startLive = useCallback(() => {
    if (!serverUrl) return;
    setTicks([]);
    setIsRunning(true);

    fetch(`${serverUrl}/agent/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal: "monitor workspace for safety" }),
    }).catch(() => {});

    const es = new EventSource(`${serverUrl}/agent/stream`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.done) {
          setIsRunning(false);
          es.close();
          return;
        }
        setTicks((prev) => [...prev, data as AgentTickEvent]);
      } catch {
        // skip malformed
      }
    };

    es.onerror = () => {
      setIsRunning(false);
      es.close();
    };
  }, [serverUrl]);

  const startAgent = useCallback(
    (m: Mode = "demo") => {
      stopAgent();
      setMode(m);
      if (m === "demo") startDemo();
      else startLive();
    },
    [stopAgent, startDemo, startLive]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (eventSourceRef.current) eventSourceRef.current.close();
    };
  }, []);

  const currentTick = ticks.length > 0 ? ticks[ticks.length - 1] : null;
  const plan = currentTick?.current_plan ?? [];
  const memories = ticks
    .filter((t) => t.observation)
    .map((t) => t.observation!)
    .filter((obs, i, arr) => arr.findIndex((o) => o.id === obs.id) === i);

  return { ticks, currentTick, plan, isRunning, memories, startAgent, stopAgent, mode };
}
