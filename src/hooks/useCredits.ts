import { useCallback, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import { credApi } from "@/lib/cred-api";
import { toastMutationError } from "@/lib/utils";

function useTokenGetter() {
  const { session } = useAuth();
  const tokenRef = useRef(session?.access_token ?? "");
  useEffect(() => {
    tokenRef.current = session?.access_token ?? "";
  }, [session?.access_token]);
  return useCallback(() => tokenRef.current, []);
}

export function useCreditBalance() {
  const getToken = useTokenGetter();
  return useQuery({
    queryKey: ["credits", "balance"],
    queryFn: () => credApi.getBalance(getToken()),
    enabled: !!getToken(),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
}

export function useDeductCredits() {
  const getToken = useTokenGetter();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ amount, description }: { amount: number; description: string }) =>
      credApi.deduct(getToken(), amount, description),
    onMutate: async ({ amount }) => {
      await qc.cancelQueries({ queryKey: ["credits", "balance"] });
      const prev = qc.getQueryData<{ balance: number }>(["credits", "balance"]);
      if (prev) {
        qc.setQueryData(["credits", "balance"], { ...prev, balance: Math.max(0, prev.balance - amount) });
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

export function useRefundCredits() {
  const getToken = useTokenGetter();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ amount, description }: { amount: number; description: string }) =>
      credApi.refund(getToken(), amount, description),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["credits", "balance"] });
      qc.invalidateQueries({ queryKey: ["credits", "transactions"] });
    },
  });
}

export function useCreateCheckout() {
  const getToken = useTokenGetter();
  return useMutation({
    mutationFn: ({ tierId, successUrl, cancelUrl }: { tierId: string; successUrl: string; cancelUrl: string }) =>
      credApi.createCheckout(getToken(), tierId, successUrl, cancelUrl),
    onError: (err) => toastMutationError("Checkout", err),
  });
}

export function usePricingTiers() {
  const getToken = useTokenGetter();
  return useQuery({
    queryKey: ["credits", "tiers"],
    queryFn: () => credApi.getPricingTiers(getToken()),
    enabled: !!getToken(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreditTransactions(page = 0, pageSize = 20) {
  const getToken = useTokenGetter();
  return useQuery({
    queryKey: ["credits", "transactions", page, pageSize],
    queryFn: () => credApi.getTransactions(getToken(), page, pageSize),
    enabled: !!getToken(),
  });
}

export function useSyncCredUser() {
  const getToken = useTokenGetter();
  return useMutation({
    mutationFn: () => credApi.syncUser(getToken()),
    onError: (err) => toastMutationError("Credit account sync", err),
    retry: 3,
  });
}
