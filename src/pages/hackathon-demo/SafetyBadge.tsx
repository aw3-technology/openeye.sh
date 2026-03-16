import { Shield } from "lucide-react";

export function SafetyBadge({ level }: { level: "SAFE" | "CAUTION" | "DANGER" }) {
  const styles =
    level === "DANGER"
      ? "bg-red-500/20 border-red-500/50 text-red-400 animate-pulse"
      : level === "CAUTION"
        ? "bg-yellow-500/20 border-yellow-500/50 text-yellow-400"
        : "bg-emerald-500/20 border-emerald-500/50 text-emerald-400";
  return (
    <div
      className={`px-4 py-1.5 rounded-full backdrop-blur-sm text-xs font-bold tracking-widest border ${styles}`}
    >
      <Shield className="inline h-3 w-3 mr-1.5 -mt-0.5" />
      {level}
    </div>
  );
}
