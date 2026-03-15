export interface CreditBalance {
  user_id: string;
  balances: {
    credit_type_id: string;
    credit_type_name: string;
    credit_type_symbol: string;
    balance: number;
  }[];
}

export interface CreditTransaction {
  id: string;
  user_id: string;
  amount: number;
  type: "purchase" | "deduction" | "refund" | "bonus";
  description: string;
  created_at: string;
}

export interface PricingTier {
  id: string;
  name: string;
  description?: string;
  credits: number;
  price: string; // e.g. "9.99"
  currency: string;
  billing_type: string;
  is_active: boolean;
  is_popular: boolean;
}

export interface CheckoutSession {
  url: string;
  session_id: string;
}

export const INFERENCE_CREDIT_COST = 1;
