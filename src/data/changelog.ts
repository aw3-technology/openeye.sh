import entries from "./changelog.json";

export interface ChangelogEntry {
  version: string;
  date: string;
  title: string;
  description: string;
  changes: {
    type: "added" | "changed" | "fixed" | "removed";
    text: string;
  }[];
  tag?: "latest" | "breaking";
  /** Pre-release milestone whose version number was never published; `version` is just an anchor id. */
  milestone?: boolean;
  /** Changes on main and openeye.sh that are not in a published openeye-sh release yet; `version` is just an anchor id. */
  unreleased?: boolean;
}

/** Short label for an entry: "v0.3.0", "Unreleased", or "Milestone" for unpublished milestones. */
export function changelogLabel(entry: ChangelogEntry): string {
  if (entry.unreleased) return "Unreleased";
  return entry.milestone ? "Milestone" : `v${entry.version}`;
}

export const changelog: ChangelogEntry[] = entries as ChangelogEntry[];

export function formatChangelogDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export const changeTypeColors: Record<ChangelogEntry["changes"][number]["type"], string> = {
  added: "text-terminal-green border-terminal-green/20",
  changed: "text-terminal-amber border-terminal-amber/20",
  fixed: "text-blue-400 border-blue-400/20",
  removed: "text-terminal-red border-terminal-red/20",
};
