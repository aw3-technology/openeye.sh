import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, AlertCircle, Info, ChevronDown, ChevronRight } from "lucide-react";
import type { UIIssue } from "@/types/openeye";

interface IssueListProps {
  issues: UIIssue[];
  selectedIndex?: number | null;
  onSelectIssue?: (index: number) => void;
}

const SEVERITY_CONFIG = {
  critical: {
    icon: AlertTriangle,
    color: "text-red-500",
    badge: "bg-red-500/15 text-red-500 border-red-500/30",
  },
  warning: {
    icon: AlertCircle,
    color: "text-amber-500",
    badge: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  },
  info: {
    icon: Info,
    color: "text-blue-400",
    badge: "bg-blue-400/15 text-blue-400 border-blue-400/30",
  },
} as const;

const TYPE_LABELS: Record<string, string> = {
  layout: "Layout",
  accessibility: "A11y",
  typography: "Type",
  visual: "Visual",
  responsive: "Responsive",
  state: "State",
};

export function IssueList({ issues, selectedIndex, onSelectIssue }: IssueListProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string | null>(null);

  const filtered = issues.filter((issue) => {
    if (filterSeverity && issue.severity !== filterSeverity) return false;
    if (filterType && issue.type !== filterType) return false;
    return true;
  });

  const counts = {
    critical: issues.filter((i) => i.severity === "critical").length,
    warning: issues.filter((i) => i.severity === "warning").length,
    info: issues.filter((i) => i.severity === "info").length,
  };

  return (
    <Card className="border-foreground/10 bg-card/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Issues ({issues.length})</CardTitle>
        {/* Severity filter chips */}
        <div className="flex gap-1.5 flex-wrap pt-1">
          {(["critical", "warning", "info"] as const).map((sev) => {
            const config = SEVERITY_CONFIG[sev];
            const isActive = filterSeverity === sev;
            return (
              <button
                key={sev}
                onClick={() => setFilterSeverity(isActive ? null : sev)}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono border transition-colors ${
                  isActive ? config.badge : "border-foreground/10 text-muted-foreground hover:border-foreground/20"
                }`}
              >
                {sev} ({counts[sev]})
              </button>
            );
          })}
        </div>
        {/* Type filter chips */}
        <div className="flex gap-1.5 flex-wrap">
          {Object.entries(TYPE_LABELS).map(([key, label]) => {
            const count = issues.filter((i) => i.type === key).length;
            if (count === 0) return null;
            const isActive = filterType === key;
            return (
              <button
                key={key}
                onClick={() => setFilterType(isActive ? null : key)}
                className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-colors ${
                  isActive ? "border-terminal-green/50 text-terminal-green" : "border-foreground/10 text-muted-foreground hover:border-foreground/20"
                }`}
              >
                {label} ({count})
              </button>
            );
          })}
        </div>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">
            {issues.length === 0 ? "No issues found." : "No issues match filters."}
          </p>
        ) : (
          <div className="space-y-1">
            {filtered.map((issue, i) => {
              const realIndex = issues.indexOf(issue);
              const config = SEVERITY_CONFIG[issue.severity as keyof typeof SEVERITY_CONFIG] ?? SEVERITY_CONFIG.info;
              const Icon = config.icon;
              const isExpanded = expandedIndex === realIndex;
              const isSelected = selectedIndex === realIndex;

              return (
                <div
                  key={`issue-${realIndex}`}
                  className={`rounded border transition-colors cursor-pointer ${
                    isSelected
                      ? "border-terminal-green/50 bg-terminal-green/5"
                      : "border-foreground/5 hover:border-foreground/10"
                  }`}
                >
                  <div
                    className="flex items-start gap-2 p-2"
                    onClick={() => {
                      onSelectIssue?.(realIndex);
                      setExpandedIndex(isExpanded ? null : realIndex);
                    }}
                  >
                    <Icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${config.color}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className={`text-[9px] px-1 py-0 ${config.badge}`}>
                          {issue.severity}
                        </Badge>
                        <Badge variant="outline" className="text-[9px] px-1 py-0 border-foreground/10">
                          {TYPE_LABELS[issue.type] ?? issue.type}
                        </Badge>
                        {issue.wcag_criterion && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 border-foreground/10 text-muted-foreground">
                            {issue.wcag_criterion}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs font-mono mt-1 leading-relaxed">{issue.description}</p>
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                    )}
                  </div>
                  {isExpanded && issue.suggestion && (
                    <div className="px-2 pb-2 pt-0 ml-5">
                      <p className="text-[11px] text-terminal-green font-mono">
                        Fix: {issue.suggestion}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
