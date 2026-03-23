import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import { credApi } from "@/lib/cred-api";
import { isCredSystemConfigured } from "@/lib/deployment-env";
import { toastMutationError } from "@/lib/utils";

export function useCreditBalance() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["credits", "balance"],
    queryFn: () => credApi.getBalance(),
    enabled: !!user,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
}

export function useDeductCredits() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ amount, description }: { amount: number; description: string }) =>
      credApi.deduct(amount, description),
    onMutate: async ({ amount }) => {
      await qc.cancelQueries({ queryKey: ["credits", "balance"] });
      const prev = qc.getQueryData<Record<string, unknown>>(["credits", "balance"]);
      if (prev && Array.isArray((prev as { balances?: unknown[] }).balances)) {
        const updated = {
          ...prev,
          balances: ((prev as { balances: Array<{ balance: number }> }).balances).map(
            (b) => ({ ...b, balance: Math.max(0, b.balance - amount) })
          ),
        };
        qc.setQueryData(["credits", "balance"], updated);
      }
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) {
        qc.setQueryData(["credits", "balance"], context.prev);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["credits", "balance"] });
      qc.invalidateQueries({ queryKey: ["credits", "transactions"] });
    },
  });
}

export function useIssueCredits() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ amount, description }: { amount: number; description: string }) =>
      credApi.issue(amount, description),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["credits", "balance"] });
      qc.invalidateQueries({ queryKey: ["credits", "transactions"] });
    },
  });
}

export function useCreateCheckout() {
  return useMutation({
    mutationFn: ({ tierId, successUrl, cancelUrl }: { tierId: string; successUrl: string; cancelUrl: string }) =>
      credApi.createCheckout(tierId, successUrl, cancelUrl),
    onError: (err) => toastMutationError("Checkout", err),
  });
}

export function usePricingTiers() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["credits", "tiers"],
    queryFn: () => credApi.getPricingTiers(),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreditTransactions(page = 0, pageSize = 20) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["credits", "transactions", page, pageSize],
    queryFn: () => credApi.getTransactions(page, pageSize),
    enabled: !!user,
  });
}

export function useSyncCredUser() {
  return useMutation({
    mutationFn: () => credApi.syncUser(),
    onError: (err) => toastMutationError("Credit account sync", err),
    retry: 3,
  });
}
