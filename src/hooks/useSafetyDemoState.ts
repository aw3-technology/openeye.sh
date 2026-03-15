import { useEffect, useState, useRef, useCallback } from "react";
import type { SafetyState, LogEntry } from "@/components/safety-demo/types";
import { scenario, CYCLE_DURATION } from "@/components/safety-demo/data";

export interface SafetyDemoState {
  currentState: SafetyState;
  logs: LogEntry[];
  handVisible: boolean;
  handPosition: { x: number; y: number };
  robotPaused: boolean;
  cycleId: number;
}

export function useSafetyDemoState(): SafetyDemoState {
  const [currentState, setCurrentState] = useState<SafetyState>("safe");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [handVisible, setHandVisible] = useState(false);
  const [handPosition, setHandPosition] = useState({ x: -20, y: 30 });
  const [robotPaused, setRobotPaused] = useState(false);
  const [cycleId, setCycleId] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const cycleRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const runCycle = useCallback(() => {
    if (!mountedRef.current) return;

    timerRef.current.forEach(clearTimeout);
    timerRef.current = [];
    setLogs([]);
    setHandVisible(false);
    setHandPosition({ x: -20, y: 30 });
    setRobotPaused(false);
    setCurrentState("safe");
    setCycleId((prev) => prev + 1);

    scenario.forEach(({ time, state, log }) => {
      const t = setTimeout(() => {
        if (!mountedRef.current) return;

        setCurrentState(state);
        setLogs((prev) => [...prev, log]);

        if (state === "warning" && log.message.includes("Motion detected")) {
          setHandVisible(true);
          setHandPosition({ x: 2, y: 30 });
        }
        if (state === "danger" && log.message.includes("HUMAN HAND")) {
          setHandPosition({ x: 8, y: 30 });
          setRobotPaused(true);
        }
        if (state === "warning" && log.message.includes("retreating")) {
          setHandPosition({ x: 2, y: 30 });
        }
        if (state === "safe" && log.message.includes("Resuming")) {
          setHandVisible(false);
          setHandPosition({ x: -20, y: 30 });
          setRobotPaused(false);
        }
      }, time);
      timerRef.current.push(t);
    });
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    runCycle();
    cycleRef.current = setInterval(runCycle, CYCLE_DURATION);

    const handleVisibilityChange = () => {
      if (document.hidden) {
        timerRef.current.forEach(clearTimeout);
        timerRef.current = [];
        if (cycleRef.current) {
          clearInterval(cycleRef.current);
          cycleRef.current = null;
        }
      } else {
        runCycle();
        cycleRef.current = setInterval(runCycle, CYCLE_DURATION);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      mountedRef.current = false;
      timerRef.current.forEach(clearTimeout);
      timerRef.current = [];
      if (cycleRef.current) clearInterval(cycleRef.current);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [runCycle]);

  return { currentState, logs, handVisible, handPosition, robotPaused, cycleId };
}
