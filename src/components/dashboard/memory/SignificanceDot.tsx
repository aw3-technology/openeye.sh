export function SignificanceDot({ value }: { value: number }) {
  const color =
    value >= 0.7
      ? "bg-terminal-red"
      : value >= 0.4
        ? "bg-terminal-amber"
        : "bg-terminal-green";
  return <div className={`w-2 h-2 rounded-full ${color} shrink-0`} />;
}
