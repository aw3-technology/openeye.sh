import { useState } from "react";
import { scoreColor } from "@/lib/utils";
import { useOpenEyeConnection } from "@/hooks/useOpenEyeConnection";
import { FileDropzone } from "@/components/dashboard/FileDropzone";
import { IssueOverlay } from "@/components/dashboard/debug/IssueOverlay";
import { IssueList } from "@/components/dashboard/debug/IssueList";
import { DiffTab } from "@/components/dashboard/debug/DiffTab";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bug, Camera, GitCompare, Eye, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import type { DebugAnalysis } from "@/types/openeye";

export default function Debug() {
  const [activeTab, setActiveTab] = useState("screenshot");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<DebugAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<number | null>(null);
  const { serverUrl } = useOpenEyeConnection();

  const handleFile = async (file: File) => {
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    setAnalysis(null);
    setSelectedIssue(null);
    setIsAnalyzing(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const resp = await fetch(`${serverUrl}/debug/analyze`, {
        method: "POST",
        body: formData,
      });

      if (!resp.ok) {
        throw new Error(`Server returned ${resp.status}`);
      }

      const data: DebugAnalysis = await resp.json();
      setAnalysis(data);

      if (data.issues.length === 0) {
        toast.success("No UI issues found!");
      } else {
        const criticals = data.issues.filter((i) => i.severity === "critical").length;
        if (criticals > 0) {
          toast.warning(`Found ${data.issues.length} issues (${criticals} critical)`);
        } else {
          toast.info(`Found ${data.issues.length} issues`);
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">Visual Debugger</h1>
        <Badge variant="outline" className="text-[10px] font-mono border-terminal-green/30 text-terminal-green">
          BETA
        </Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="screenshot" className="gap-1.5">
            <Camera className="h-3.5 w-3.5" />
            Screenshot
          </TabsTrigger>
          <TabsTrigger value="diff" className="gap-1.5">
            <GitCompare className="h-3.5 w-3.5" />
            Diff
          </TabsTrigger>
          <TabsTrigger value="live" className="gap-1.5">
            <Eye className="h-3.5 w-3.5" />
            Live Watch
          </TabsTrigger>
        </TabsList>

        <TabsContent value="screenshot" className="space-y-4 mt-4">
          <FileDropzone onFile={handleFile} disabled={isAnalyzing} />

          {isAnalyzing && (
            <div className="flex items-center justify-center gap-2 py-8" role="status">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              <span className="text-sm text-muted-foreground">Analyzing UI with VLM...</span>
            </div>
          )}

          {analysis && (
            <>
              {/* Score summary */}
              <div className="grid gap-4 sm:grid-cols-4">
                <Card className="border-foreground/10 bg-card/50 backdrop-blur-sm">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-1.5">
                      <Bug className="h-3.5 w-3.5 text-terminal-green" />
                      <CardTitle className="text-xs text-muted-foreground">Overall Score</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className={`text-2xl font-semibold tabular-nums ${scoreColor(analysis.overall_score)}`}>
                      {analysis.overall_score}/100
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-foreground/10 bg-card/50 backdrop-blur-sm">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
                      <CardTitle className="text-xs text-muted-foreground">Critical</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-semibold tabular-nums text-red-400">
                      {analysis.issues.filter((i) => i.severity === "critical").length}
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-foreground/10 bg-card/50 backdrop-blur-sm">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-terminal-amber" />
                      <CardTitle className="text-xs text-muted-foreground">Warnings</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-semibold tabular-nums text-terminal-amber">
                      {analysis.issues.filter((i) => i.severity === "warning").length}
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-foreground/10 bg-card/50 backdrop-blur-sm">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
                      <CardTitle className="text-xs text-muted-foreground">Analysis Time</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-semibold tabular-nums">
                      {(analysis.analysis_ms / 1000).toFixed(1)}s
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Category scores */}
              {Object.keys(analysis.categories).length > 0 && (
                <Card className="border-foreground/10 bg-card/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider">Category Scores</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                      {Object.entries(analysis.categories).map(([cat, score]) => (
                        <div key={cat} className="text-center">
                          <p className={`text-lg font-semibold tabular-nums ${scoreColor(score)}`}>{score}</p>
                          <p className="text-[10px] font-mono text-muted-foreground uppercase">{cat}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Image + issues */}
              <div className="grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <IssueOverlay
                    issues={analysis.issues}
                    imageUrl={imageUrl ?? undefined}
                    selectedIndex={selectedIssue}
                    onSelectIssue={setSelectedIssue}
                  />
                </div>
                <div>
                  <IssueList
                    issues={analysis.issues}
                    selectedIndex={selectedIssue}
                    onSelectIssue={setSelectedIssue}
                  />
                </div>
              </div>

              {/* Summary */}
              {analysis.summary && (
                <Card className="border-foreground/10 bg-card/50">
                  <CardContent className="pt-4">
                    <p className="text-sm font-mono">{analysis.summary}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Analyzed by {analysis.model} in {analysis.analysis_ms.toFixed(0)}ms
                    </p>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="diff" className="mt-4">
          <DiffTab serverUrl={serverUrl} />
        </TabsContent>

        <TabsContent value="live" className="mt-4">
          <p className="text-sm text-muted-foreground">
            Live watch mode streams frames via WebSocket. Use the CLI for live monitoring:
          </p>
          <pre className="mt-2 rounded bg-foreground/5 p-3 text-xs font-mono">
            openeye debug watch --url http://localhost:3000 --interval 5
          </pre>
        </TabsContent>
      </Tabs>
    </div>
  );
}
