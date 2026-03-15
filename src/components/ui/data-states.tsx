import { cn } from "@/lib/utils";

interface DataStateProps {
  message?: string;
  className?: string;
}

export function LoadingState({ message = "Loading...", className }: DataStateProps) {
  return <p className={cn("text-sm text-muted-foreground", className)}>{message}</p>;
}

export function EmptyState({ message = "No items found.", className }: DataStateProps) {
  return <p className={cn("text-sm text-muted-foreground", className)}>{message}</p>;
}

export function ErrorState({ message = "Something went wrong.", className }: DataStateProps) {
  return <p className={cn("text-sm text-destructive", className)}>{message}</p>;
}
