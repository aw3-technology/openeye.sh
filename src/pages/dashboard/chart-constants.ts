export const chartColors = {
  grid: "hsl(var(--border))",
  axis: "hsl(var(--muted-foreground))",
  green: "hsl(var(--terminal-green))",
  amber: "hsl(var(--terminal-amber))",
  primary: "hsl(var(--primary))",
  red: "hsl(0 72% 51%)",
  blue: "hsl(217 91% 60%)",
  muted: "hsl(var(--muted-foreground))",
} as const;

export const tooltipStyle: React.CSSProperties = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  fontSize: 12,
  borderRadius: 6,
  fontFamily: "monospace",
};
