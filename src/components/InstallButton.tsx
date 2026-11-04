import { useState } from "react";
import { Check, Copy } from "lucide-react";

const INSTALL_COMMAND = "pipx install openeye-sh";

/** Install command as a pill that copies itself to the clipboard. */
export function InstallButton() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(INSTALL_COMMAND);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="group inline-flex items-center gap-3 rounded-full border border-foreground/10 bg-foreground/[0.03] px-5 py-2.5 font-mono text-sm text-foreground/90 transition-colors hover:border-foreground/20 hover:bg-foreground/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
    >
      <span className="text-muted-foreground">$</span>
      {INSTALL_COMMAND}
      {copied ? (
        <Check className="h-3.5 w-3.5 text-primary" aria-label="Copied" />
      ) : (
        <Copy className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground" aria-label="Copy install command" />
      )}
    </button>
  );
}
