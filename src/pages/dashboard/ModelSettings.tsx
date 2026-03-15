import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function ModelSettings() {
  const [confidence, setConfidence] = useState(0.5);
  const [nms, setNms] = useState(0.45);
  const [maxDetections, setMaxDetections] = useState(100);
  const [classFilter, setClassFilter] = useState("");

  const handleSave = () => {
    // Settings are stored in-memory and used client-side for filtering
    localStorage.setItem(
      "openeye_model_params",
      JSON.stringify({
        confidence_threshold: confidence,
        nms_threshold: nms,
        max_detections: maxDetections,
        class_filter: classFilter
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      }),
    );
    toast.success("Settings saved");
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Model Settings</h1>
      <p className="text-sm text-muted-foreground">
        These settings filter detection results client-side before display.
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detection Parameters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Confidence Threshold</Label>
              <span className="text-sm font-mono tabular-nums">{confidence.toFixed(2)}</span>
            </div>
            <Slider
              value={[confidence]}
              onValueChange={([v]) => setConfidence(v)}
              min={0}
              max={1}
              step={0.01}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>NMS Threshold</Label>
              <span className="text-sm font-mono tabular-nums">{nms.toFixed(2)}</span>
            </div>
            <Slider
              value={[nms]}
              onValueChange={([v]) => setNms(v)}
              min={0}
              max={1}
              step={0.01}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="max-detections">Max Detections</Label>
            <Input
              id="max-detections"
              type="number"
              value={maxDetections}
              onChange={(e) => setMaxDetections(Math.max(1, Math.min(1000, Math.floor(Number(e.target.value) || 1))))}
              min={1}
              max={1000}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="class-filter">Class Filter (comma-separated)</Label>
            <Input
              id="class-filter"
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              placeholder="e.g. person, car, dog"
            />
            <p className="text-xs text-muted-foreground">
              Leave empty to show all classes.
            </p>
          </div>

          <Button onClick={handleSave}>Save Settings</Button>
        </CardContent>
      </Card>
    </div>
  );
}
