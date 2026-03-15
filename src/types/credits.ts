export interface CreditBalance {
  balance: number;
  user_id: string;
  project_id: string;
}

export interface CreditTransaction {
  id: string;
  user_id: string;
  project_id: string;
  amount: number;
  type: "purchase" | "deduction" | "refund" | "bonus";
  description: string;
  created_at: string;
}

export interface PricingTier {
  id: string;
  name: string;
  credits: number;
  price_cents: number;
  popular?: boolean;
}

export interface CheckoutSession {
  url: string;
  session_id: string;
}

export const INFERENCE_CREDIT_COST = 1;
