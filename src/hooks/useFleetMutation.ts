import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toastMutationError } from "@/lib/utils";

interface FleetMutationOptions<TInput, TResult> {
  /** The mutation function */
  mutationFn: (input: TInput) => Promise<TResult>;
  /** Human-readable action name for error toasts */
  actionName: string;
  /** Query keys to invalidate on settle. Can be a function receiving the input. */
  invalidateKeys: readonly string[][] | ((input: TInput) => readonly string[][]);
}

/**
 * Factory for fleet mutation hooks. Standardizes error toasting and query invalidation.
 */
export function useFleetMutation<TInput, TResult = unknown>({
  mutationFn,
  actionName,
  invalidateKeys,
}: FleetMutationOptions<TInput, TResult>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onError: (err: Error) => toastMutationError(actionName, err),
    onSettled: (_data, _error, input) => {
      const keys = typeof invalidateKeys === "function" ? invalidateKeys(input) : invalidateKeys;
      for (const key of keys) {
        qc.invalidateQueries({ queryKey: key });
      }
    },
  });
}
