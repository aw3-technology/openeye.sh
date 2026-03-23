import { useState, useCallback } from "react";
import type { PerceptionFrame, ZoneLevel } from "@/types/openeye";

export function usePerceptionSafety() {
  const [overallSafetyState, setOverallSafetyState] = useState<ZoneLevel>("safe");
  const [haltActive, setHaltActive] = useState(false);

  const deriveSafetyState = useCallback((frame: PerceptionFrame) => {
    let worst: ZoneLevel = "safe";
    let halt = false;
    for (const alert of frame.safety_alerts) {
      if (alert.halt_recommended) halt = true;
      if (alert.zone === "danger") worst = "danger";
      else if (alert.zone === "caution" && worst !== "danger") worst = "caution";
    }
    setOverallSafetyState(worst);
    setHaltActive(halt);
  }, []);

  return { overallSafetyState, haltActive, deriveSafetyState };
}
