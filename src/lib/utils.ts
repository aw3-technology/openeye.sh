import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { toast } from "sonner";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Standardised mutation error toast. Extracts the message from any error shape. */
export function toastMutationError(action: string, err?: unknown): void {
  const detail = err instanceof Error ? err.message : err ? String(err) : undefined;
  toast.error(detail ? `${action} failed: ${detail}` : `${action} failed`);
}
