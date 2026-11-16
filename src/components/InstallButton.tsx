import { useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { copyText } from "@/lib/clipboard";

const INSTALL_COMMAND = "pipx install openeye-sh";

/** Install command as a pill that copies itself to the clipboard. */
export function InstallButton() {
  const [copied, setCopied] = useState(false);
  const command = useRef<HTMLSpanElement>(null);
  const copy = async () => {
    if (await copyText(INSTALL_COMMAND)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
      return;
    }
    // The browser refused the clipboard: select the command so ⌘C / Ctrl+C works.
    const el = command.current;
    const selection = window.getSelection();
    if (!el || !selection) return;
    const range = document.createRange();
    range.selectNodeContents(el);
    selection.removeAllRanges();
    selection.addRange(range);
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="group inline-flex items-center gap-3 rounded-full border border-foreground/10 bg-foreground/[0.03] px-5 py-2.5 font-mono text-sm text-foreground/90 transition-colors hover:border-foreground/20 hover:bg-foreground/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
    >
      <span className="text-muted-foreground">$</span>
      <span ref={command}>{INSTALL_COMMAND}</span>
      {copied ? (
        <Check className="h-3.5 w-3.5 text-primary" aria-label="Copied" />
      ) : (
        <Copy className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground" aria-label="Copy install command" />
      )}
    </button>
  );
}
