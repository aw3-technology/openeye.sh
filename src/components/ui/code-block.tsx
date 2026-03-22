import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface CodeBlockProps {
  code: string;
  lang?: string;
}

export function CodeBlock({ code, lang = "bash" }: CodeBlockProps) {
  return (
    <div className="relative group">
      <pre className="rounded-md bg-muted/50 border p-4 text-xs font-mono overflow-x-auto whitespace-pre">
        {code}
      </pre>
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label="Copy code"
        onClick={() => {
          navigator.clipboard.writeText(code).then(
            () => toast.success("Copied to clipboard"),
            () => toast.error("Failed to copy"),
          );
        }}
      >
        <Copy className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
