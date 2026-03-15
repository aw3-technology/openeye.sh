import type { UIIssue } from "@/types/openeye";

interface IssueOverlayProps {
  issues: UIIssue[];
  imageUrl?: string;
  className?: string;
  selectedIndex?: number | null;
  onSelectIssue?: (index: number) => void;
}

// Tailwind safelist: border-red-500 bg-red-500/10 border-amber-500 bg-amber-500/10
// border-blue-400 bg-blue-400/10 bg-red-500 bg-amber-500 bg-blue-400

const SEVERITY_COLORS = {
  critical: {
    border: "border-red-500",
    bg: "bg-red-500/10",
    label: "bg-red-500",
    text: "text-red-500",
  },
  warning: {
    border: "border-amber-500",
    bg: "bg-amber-500/10",
    label: "bg-amber-500",
    text: "text-amber-500",
  },
  info: {
    border: "border-blue-400",
    bg: "bg-blue-400/10",
    label: "bg-blue-400",
    text: "text-blue-400",
  },
} as const;

export function IssueOverlay({
  issues,
  imageUrl,
  className = "",
  selectedIndex = null,
  onSelectIssue,
}: IssueOverlayProps) {
  return (
    <div className={`relative bg-foreground rounded-lg overflow-hidden ${className}`}>
      {imageUrl ? (
        <img src={imageUrl} alt="Screenshot under analysis" className="w-full h-full object-contain" />
      ) : (
        <div className="aspect-video bg-gradient-to-br from-foreground via-foreground/95 to-foreground/90" />
      )}

      {issues.map((issue, i) => {
        const colors = SEVERITY_COLORS[issue.severity as keyof typeof SEVERITY_COLORS] ?? SEVERITY_COLORS.info;
        const hasBox = issue.bbox.w > 0 && issue.bbox.h > 0;
        const isSelected = selectedIndex === i;

        if (!hasBox) return null;

        return (
          <div
            key={`issue-${i}`}
            className={`absolute cursor-pointer transition-opacity ${isSelected ? "opacity-100" : "opacity-70 hover:opacity-100"}`}
            style={{
              left: `${issue.bbox.x * 100}%`,
              top: `${issue.bbox.y * 100}%`,
              width: `${issue.bbox.w * 100}%`,
              height: `${issue.bbox.h * 100}%`,
            }}
            onClick={() => onSelectIssue?.(i)}
          >
            <div
              className={`w-full h-full border ${colors.border} ${colors.bg} ${
                isSelected ? "border-2 ring-2 ring-white/30" : "border-[0.5px]"
              }`}
            />
            <span
              className={`absolute -top-5 left-0 text-[10px] font-mono px-1.5 py-0.5 tabular-nums text-white ${colors.label}`}
            >
              {issue.severity.toUpperCase()}: {issue.type}
            </span>
            {/* Corner markers */}
            <div className={`absolute top-0 left-0 w-2 h-2 border-t border-l ${colors.border}`} />
            <div className={`absolute top-0 right-0 w-2 h-2 border-t border-r ${colors.border}`} />
            <div className={`absolute bottom-0 left-0 w-2 h-2 border-b border-l ${colors.border}`} />
            <div className={`absolute bottom-0 right-0 w-2 h-2 border-b border-r ${colors.border}`} />
          </div>
        );
      })}
    </div>
  );
}
