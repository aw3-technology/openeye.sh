import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Crosshair, Layers } from "lucide-react";
import { toast } from "sonner";
import type { ModelParameters } from "@/types/openeye";
import { PresetButton } from "./shared";

export function DetectionTab({
  detection,
  updateDetection,
  classFilterText,
  onClassFilterTextChange,
}: {
  detection: ModelParameters;
  updateDetection: (patch: Partial<ModelParameters>) => void;
  classFilterText: string;
  onClassFilterTextChange: (value: string) => void;
}) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Crosshair className="h-4 w-4 text-terminal-green" />
            Detection Parameters
          </CardTitle>
          <CardDescription>
            Client-side filtering applied to detection results before display.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Confidence threshold */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Confidence Threshold</Label>
              <span className="text-sm font-mono tabular-nums text-terminal-green">
                {detection.confidence_threshold.toFixed(2)}
              </span>
            </div>
            <Slider
              value={[detection.confidence_threshold]}
              onValueChange={([v]) =>
                updateDetection({ confidence_threshold: v })
              }
              min={0}
              max={1}
              step={0.01}
            />
            <p className="text-xs text-muted-foreground">
              Minimum confidence score to display a detection. Lower values
              show more detections; higher values filter out uncertain ones.
            </p>
          </div>

          {/* NMS threshold */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>NMS Threshold (IoU)</Label>
              <span className="text-sm font-mono tabular-nums text-terminal-amber">
                {detection.nms_threshold.toFixed(2)}
              </span>
            </div>
            <Slider
              value={[detection.nms_threshold]}
              onValueChange={([v]) =>
                updateDetection({ nms_threshold: v })
              }
              min={0}
              max={1}
              step={0.01}
            />
            <p className="text-xs text-muted-foreground">
              Non-Maximum Suppression IoU overlap threshold. Lower values
              suppress more overlapping boxes.
            </p>
          </div>

          {/* Max detections */}
          <div className="space-y-2">
            <Label htmlFor="max-detections">Max Detections</Label>
            <Input
              id="max-detections"
              type="number"
              value={detection.max_detections}
              onChange={(e) =>
                updateDetection({
                  max_detections: Math.max(
                    1,
                    Math.min(1000, Math.floor(Number(e.target.value) || 1)),
                  ),
                })
              }
              min={1}
              max={1000}
              className="max-w-[200px]"
            />
            <p className="text-xs text-muted-foreground">
              Maximum number of objects to display per frame (1–1000).
            </p>
          </div>

          {/* Class filter */}
          <div className="space-y-2">
            <Label htmlFor="class-filter">Class Filter</Label>
            <Input
              id="class-filter"
              value={classFilterText}
              onChange={(e) => onClassFilterTextChange(e.target.value)}
              placeholder="e.g. person, car, dog"
            />
            <p className="text-xs text-muted-foreground">
              Comma-separated list of COCO class names to show. Leave empty
              to display all classes.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Quick presets */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Quick Presets
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            <PresetButton
              label="High Recall"
              description="Catch everything — low confidence, high NMS"
              onClick={() => {
                updateDetection({
                  confidence_threshold: 0.15,
                  nms_threshold: 0.7,
                  max_detections: 300,
                });
                toast.success("Applied High Recall preset");
              }}
            />
            <PresetButton
              label="Balanced"
              description="Good balance of precision and recall"
              onClick={() => {
                updateDetection({
                  confidence_threshold: 0.5,
                  nms_threshold: 0.45,
                  max_detections: 100,
                });
                toast.success("Applied Balanced preset");
              }}
            />
            <PresetButton
              label="High Precision"
              description="Only high-confidence detections"
              onClick={() => {
                updateDetection({
                  confidence_threshold: 0.75,
                  nms_threshold: 0.3,
                  max_detections: 50,
                });
                toast.success("Applied High Precision preset");
              }}
            />
          </div>
        </CardContent>
      </Card>
    </>
  );
}
