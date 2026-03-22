import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Cpu, Download, Eye, Terminal, Trash2 } from "lucide-react";
import { CliCommandCard } from "./CliCommandCard";

export function CliQuickReference() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Terminal className="h-4 w-4" />
          CLI Quick Reference
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <CliCommandCard
            icon={<Download className="h-4 w-4 text-terminal-green" />}
            title="Pull a model"
            command="openeye pull yolov8"
            description="Download weights to ~/.openeye/models/"
          />
          <CliCommandCard
            icon={<Cpu className="h-4 w-4 text-terminal-amber" />}
            title="Run inference"
            command="openeye run yolov8 photo.jpg"
            description="Run detection on a single image"
          />
          <CliCommandCard
            icon={<Eye className="h-4 w-4 text-blue-400" />}
            title="List models"
            command="openeye list"
            description="Show all available and downloaded models"
          />
          <CliCommandCard
            icon={<Trash2 className="h-4 w-4 text-destructive" />}
            title="Remove a model"
            command="openeye remove yolov8"
            description="Delete downloaded model weights"
          />
        </div>

        <div className="p-3 bg-muted/50 rounded-md border">
          <p className="text-xs text-muted-foreground mb-2 font-medium">
            Install extras for specific model families:
          </p>
          <div className="space-y-1">
            {[
              { cmd: "pipx install openeye-sh[yolo]", note: "YOLO + YOLO26" },
              { cmd: "pipx install openeye-sh[grounding]", note: "Grounding DINO" },
              { cmd: "pipx install openeye-sh[sam]", note: "SAM 2 segmentation" },
              { cmd: "pipx install openeye-sh[depth]", note: "Depth Anything V2" },
              { cmd: "pipx install openeye-sh[vla]", note: "SmolVLA actions" },
              { cmd: "pipx install openeye-sh[vlm]", note: "VLM inference" },
            ].map((item) => (
              <code
                key={item.cmd}
                className="block text-xs font-mono text-muted-foreground"
              >
                $ {item.cmd}{" "}
                <span className="text-muted-foreground/60">
                  # {item.note}
                </span>
              </code>
            ))}
            <code className="block text-xs font-mono text-terminal-green">
              $ pipx install openeye-sh[all]{" "}
              <span className="text-muted-foreground"># everything</span>
            </code>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
