import { toast } from "sonner";

export function CliCommandCard({
  icon,
  title,
  command,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  command: string;
  description: string;
}) {
  const handleCopy = () => {
    navigator.clipboard.writeText(command);
    toast.success("Copied to clipboard");
  };

  return (
    <button
      onClick={handleCopy}
      className="rounded-md border bg-card p-3 space-y-2 text-left hover:bg-accent transition-colors w-full"
    >
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm font-medium">{title}</span>
      </div>
      <code className="block text-xs font-mono bg-secondary text-oe-green px-2 py-1.5 rounded">
        $ {command}
      </code>
      <p className="text-xs text-muted-foreground">{description}</p>
    </button>
  );
}
