export function PresetButton({
  label,
  description,
  onClick,
}: {
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-md border bg-card p-3 text-left space-y-1 hover:bg-accent transition-colors"
    >
      <span className="text-sm font-medium">{label}</span>
      <p className="text-xs text-muted-foreground">{description}</p>
    </button>
  );
}

export function ConfigSummaryItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border px-3 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-mono font-medium">{value}</span>
    </div>
  );
}
