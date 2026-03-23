import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Download, FileJson, FileSpreadsheet, Image } from "lucide-react";
import type { DetectedObject, InferenceHistoryRow } from "@/types/openeye";
import { exportJSON, exportCSV, exportCOCO, exportAnnotatedImage } from "./exportFormats";
import { ExportPreview } from "./ExportPreview";

interface ExportActionsProps {
  selected: InferenceHistoryRow | null;
  selectedObjects: DetectedObject[];
}

export function ExportActions({ selected, selectedObjects }: ExportActionsProps) {
  return (
    <Card className="lg:col-span-2">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Export Options</CardTitle>
      </CardHeader>
      <CardContent>
        {!selected ? (
          <p className="text-sm text-muted-foreground">Select a result to export.</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <p>
                <span className="text-muted-foreground">Model:</span> {selected.model}
              </p>
              <p>
                <span className="text-muted-foreground">Task:</span> {selected.task}
              </p>
              <p>
                <span className="text-muted-foreground">Resolution:</span>{" "}
                <span className="tabular-nums">{selected.image_width}×{selected.image_height}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Inference:</span>{" "}
                <span className="tabular-nums">{selected.inference_ms.toFixed(1)}ms</span>
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button variant="outline" className="gap-2" onClick={() => exportJSON(selected)}>
                <FileJson className="h-4 w-4" />
                JSON
              </Button>
              <Button variant="outline" className="gap-2" onClick={() => exportCSV(selected)}>
                <FileSpreadsheet className="h-4 w-4" />
                CSV
              </Button>
              <Button variant="outline" className="gap-2" onClick={() => exportCOCO(selected)}>
                <Download className="h-4 w-4" />
                COCO
              </Button>
              <Button variant="outline" className="gap-2" onClick={() => exportAnnotatedImage(selected)}>
                <Image className="h-4 w-4" />
                Annotated PNG
              </Button>
            </div>

            <Separator />
            <ExportPreview objects={selectedObjects} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
