export interface CreditBalanceEntry {
  credit_type_id: string;
  credit_type_name: string;
  credit_type_symbol: string;
  balance: number;
}

export interface CreditBalance {
  user_id: string;
  email?: string;
  balances: CreditBalanceEntry[];
}

export interface CreditTransaction {
  id: string;
  user_id: string;
  amount: number;
  type: "purchase" | "deduction" | "refund" | "bonus" | "issued" | "deducted";
  description: string;
  reason?: string;
  created_at: string;
  credit_type_id?: string;
}

export interface PricingTier {
  id: string;
  name: string;
  description?: string;
  credits: number;
  /** Price as a 2-decimal string from the API, e.g. "9.99" */
  price: string;
  currency?: string;
  billing_type?: "one_time" | "subscription";
  is_popular?: boolean;
}

export interface CheckoutSession {
  url: string;
  session_id: string;
  purchase_id?: string;
}

/** Helper to sum all balances into a single number */
export function getTotalBalance(bal: CreditBalance | undefined | null): number {
  if (!bal?.balances) return 0;
  return bal.balances.reduce((sum, b) => sum + b.balance, 0);
}

export const INFERENCE_CREDIT_COST = 1;
