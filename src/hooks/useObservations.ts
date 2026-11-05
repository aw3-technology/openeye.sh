import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { demoObservations } from "@/components/dashboard/memory/data";
import type { Observation } from "@/types/agent";
import type { DetectedObject } from "@/types/openeye";

/** Row shape of the observation_memory table (db/schema.sql). */
interface ObservationRow {
  id: string;
  tick: number;
  timestamp: string;
  detections_json: DetectedObject[] | null;
  scene_summary: string | null;
  change_description: string | null;
  significance: number | null;
  tags: string[] | null;
  session_id: string | null;
}

function toObservation(row: ObservationRow): Observation {
  return {
    id: row.id,
    tick: row.tick,
    timestamp: row.timestamp,
    detections: row.detections_json ?? [],
    scene_summary: row.scene_summary ?? "",
    change_description: row.change_description ?? "",
    significance: row.significance ?? 0,
    tags: row.tags ?? [],
  };
}

/**
 * Observations saved by the agent loop. The demo user gets the bundled
 * sample session instead.
 */
export function useObservations() {
  const { user, isDemo } = useAuth();
  return useQuery({
    queryKey: ["openeye", "observations", user?.id, isDemo],
    queryFn: async () => {
      if (isDemo) return { observations: demoObservations, isSample: true };
      const { data } = await api.list<ObservationRow>("observation_memory", { limit: 1000 });
      return { observations: data.map(toObservation), isSample: false };
    },
    enabled: !!user,
  });
}

/** Saves one agent-loop observation for the signed-in user (no-op in demo mode). */
export function useSaveObservation() {
  const { user, isDemo } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ observation, sessionId }: { observation: Observation; sessionId: string }) => {
      if (!user || isDemo) return;
      await api.create("observation_memory", {
        tick: observation.tick,
        timestamp: observation.timestamp,
        detections_json: observation.detections,
        scene_summary: observation.scene_summary,
        change_description: observation.change_description,
        significance: Math.min(Math.max(observation.significance, 0), 1),
        tags: observation.tags,
        session_id: sessionId,
      });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["openeye", "observations"] }),
  });
}
