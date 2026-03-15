import { useState, useEffect } from "react";
import { useOpenEyeConnection } from "@/hooks/useOpenEyeConnection";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Cpu,
  Download,
  Search,
  CheckCircle2,
  Circle,
  Terminal,
  Trash2,
  HardDrive,
} from "lucide-react";

interface ModelEntry {
  key: string;
  name: string;
  task: string;
  adapter: string;
  size_mb?: number;
  downloaded: boolean;
  extras?: string;
}

const KNOWN_MODELS: ModelEntry[] = [
  {
    key: "yolov8",
    name: "YOLOv8",
    task: "detection",
    adapter: "yolov8",
    size_mb: 22,
    downloaded: false,
    extras: "pip install openeye-ai[yolo]",
  },
  {
    key: "depth_anything",
    name: "Depth Anything V2",
    task: "depth",
    adapter: "depth_anything",
    size_mb: 350,
    downloaded: false,
    extras: "pip install openeye-ai[depth]",
  },
  {
    key: "grounding_dino",
    name: "Grounding DINO",
    task: "detection (open-vocab)",
    adapter: "grounding_dino",
    size_mb: 680,
    downloaded: false,
    extras: "pip install openeye-ai[grounding]",
  },
];

export default function ModelRegistry() {
  const { isConnected, healthData } = useOpenEyeConnection();
  const [search, setSearch] = useState("");
  const [models, setModels] = useState<ModelEntry[]>(KNOWN_MODELS);

  // Mark the active model as downloaded
  useEffect(() => {
    if (!healthData?.model) return;
    setModels((prev) =>
      prev.map((m) =>
        healthData.model.toLowerCase().includes(m.key.replace("_", ""))
          ? { ...m, downloaded: true }
          : m,
      ),
    );
  }, [healthData]);

  const filtered = models.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.task.toLowerCase().includes(search.toLowerCase()) ||
      m.key.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Cpu className="h-5 w-5 text-terminal-green" />
          <h1 className="text-2xl font-semibold">Model Registry</h1>
        </div>
        <Badge
          variant="outline"
          className="font-mono text-xs border-terminal-green/30 text-terminal-green"
        >
          {models.filter((m) => m.downloaded).length}/{models.length} downloaded
        </Badge>
      </div>

      <p className="text-sm text-muted-foreground max-w-2xl">
        View available models and their status. Models are managed via the CLI —
        use the commands below to pull, run, or remove models.
      </p>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Filter models..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Models Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <HardDrive className="h-4 w-4" />
            Available Models
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Task</TableHead>
                <TableHead>Adapter</TableHead>
                <TableHead className="text-right">Size</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((model) => (
                <TableRow key={model.key}>
                  <TableCell>
                    {model.downloaded ? (
                      <CheckCircle2 className="h-4 w-4 text-terminal-green" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground" />
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{model.name}</span>
                      {healthData?.model &&
                        healthData.model.toLowerCase().includes(model.key.replace("_", "")) && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] px-1.5 py-0"
                          >
                            Active
                          </Badge>
                        )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs font-mono">
                      {model.task}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {model.adapter}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm tabular-nums">
                    {model.size_mb ? `${model.size_mb} MB` : "—"}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-sm text-muted-foreground py-8"
                  >
                    No models match your filter.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* CLI Quick Reference */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Terminal className="h-4 w-4" />
            CLI Commands
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <CliCommandCard
              icon={<Download className="h-4 w-4 text-terminal-green" />}
              title="Pull a model"
              command="openeye pull yolov8"
              description="Download model weights to ~/.openeye/models/"
            />
            <CliCommandCard
              icon={<Cpu className="h-4 w-4 text-terminal-amber" />}
              title="Run inference"
              command="openeye run yolov8 photo.jpg"
              description="Run detection on a single image"
            />
            <CliCommandCard
              icon={<Trash2 className="h-4 w-4 text-destructive" />}
              title="Remove a model"
              command="openeye remove yolov8"
              description="Delete downloaded model weights"
            />
          </div>

          <div className="mt-4 p-3 bg-muted/50 rounded-md border">
            <p className="text-xs text-muted-foreground mb-2 font-medium">
              Install extras for specific models:
            </p>
            <div className="space-y-1">
              {KNOWN_MODELS.filter((m) => m.extras).map((m) => (
                <code
                  key={m.key}
                  className="block text-xs font-mono text-muted-foreground"
                >
                  $ {m.extras}
                </code>
              ))}
              <code className="block text-xs font-mono text-terminal-green">
                $ pip install openeye-ai[all]{" "}
                <span className="text-muted-foreground"># everything</span>
              </code>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CliCommandCard({
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
  return (
    <div className="rounded-md border bg-card p-3 space-y-2">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm font-medium">{title}</span>
      </div>
      <code className="block text-xs font-mono bg-terminal-bg text-terminal-green px-2 py-1.5 rounded">
        $ {command}
      </code>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}
