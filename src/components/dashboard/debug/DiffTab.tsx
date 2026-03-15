import { useState } from "react";
import { FileDropzone } from "@/components/dashboard/FileDropzone";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { DiffResult, DiffChange } from "@/types/openeye";

interface DiffTabProps {
  serverUrl: string;
}

export function DiffTab({ serverUrl }: DiffTabProps) {
  const [beforeUrl, setBeforeUrl] = useState<string | null>(null);
  const [afterUrl, setAfterUrl] = useState<string | null>(null);
  const [beforeFile, setBeforeFile] = useState<File | null>(null);
  const [diffResult, setDiffResult] = useState<DiffResult | null>(null);
  const [isComparing, setIsComparing] = useState(false);

  const handleBefore = (file: File) => {
    setBeforeUrl(URL.createObjectURL(file));
    setBeforeFile(file);
    setDiffResult(null);
  };

  const handleAfter = async (file: File) => {
    const url = URL.createObjectURL(file);
    setAfterUrl(url);
    setDiffResult(null);

    if (!beforeFile) {
      toast.info("Upload the 'before' screenshot first.");
      return;
    }

    setIsComparing(true);
    try {
      const formData = new FormData();
      formData.append("before", beforeFile);
      formData.append("after", file);

      const resp = await fetch(`${serverUrl}/debug/diff`, {
        method: "POST",
        body: formData,
      });

      if (!resp.ok) throw new Error(`Server returned ${resp.status}`);
      setDiffResult(await resp.json());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Diff failed");
    } finally {
      setIsComparing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <p className="text-xs font-mono text-muted-foreground mb-2 uppercase tracking-wider">Before</p>
          {beforeUrl ? (
            <img src={beforeUrl} alt="Before" className="rounded-lg border border-foreground/10 w-full object-contain" />
          ) : (
            <FileDropzone onFile={handleBefore} disabled={isComparing} />
          )}
        </div>
        <div>
          <p className="text-xs font-mono text-muted-foreground mb-2 uppercase tracking-wider">After</p>
          {afterUrl ? (
            <img src={afterUrl} alt="After" className="rounded-lg border border-foreground/10 w-full object-contain" />
          ) : (
            <FileDropzone onFile={handleAfter} disabled={isComparing || !beforeFile} />
          )}
        </div>
      </div>

      {isComparing && (
        <div className="flex items-center justify-center gap-2 py-8">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm text-muted-foreground">Comparing screenshots...</span>
        </div>
      )}

      {diffResult && (
        <Card className={`border-foreground/10 ${diffResult.regression_detected ? "border-red-500/30" : "border-terminal-green/30"}`}>
          <CardContent className="pt-4 space-y-2">
            <div className="flex items-center gap-2">
              {diffResult.regression_detected ? (
                <Badge variant="destructive" className="text-[10px]">REGRESSION DETECTED</Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] text-terminal-green border-terminal-green/30">NO REGRESSIONS</Badge>
              )}
              <span className="text-xs font-mono text-muted-foreground">
                Pixel diff: {diffResult.pixel_diff_pct?.toFixed(1) ?? "N/A"}% | SSIM: {diffResult.ssim?.toFixed(4) ?? "N/A"}
              </span>
            </div>
            <p className="text-sm font-mono">{diffResult.summary}</p>
            {diffResult.changes?.map((change: DiffChange, i: number) => (
              <div key={i} className="flex items-start gap-2 text-xs font-mono border border-foreground/5 rounded p-2">
                <Badge variant="outline" className={`text-[9px] ${
                  change.severity === "critical" ? "text-red-500 border-red-500/30" :
                  change.severity === "warning" ? "text-amber-500 border-amber-500/30" :
                  "text-blue-400 border-blue-400/30"
                }`}>
                  {change.severity}
                </Badge>
                <div>
                  <p>{change.description}</p>
                  {change.suggestion && <p className="text-terminal-green mt-0.5">Fix: {change.suggestion}</p>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
