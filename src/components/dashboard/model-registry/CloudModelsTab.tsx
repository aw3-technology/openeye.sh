import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Brain, Zap } from "lucide-react";
import { vlmModelOptions, cortexLlmOptions } from "@/data/modelOptions";
import { ProviderCard } from "./ProviderCard";

export function CloudModelsTab() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="h-4 w-4 text-terminal-amber" />
            VLM Models (Vision-Language)
          </CardTitle>
          <CardDescription>
            Multimodal models for scene reasoning, accessed via cloud API.
            Selected in{" "}
            <span className="font-mono text-xs">Model Settings</span> or{" "}
            <span className="font-mono text-xs">Config Editor</span>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Model</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Model ID</TableHead>
                <TableHead className="text-right">Tier</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vlmModelOptions.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.label}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className="text-xs font-mono"
                    >
                      {m.provider}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground max-w-[200px] truncate">
                    {m.id}
                  </TableCell>
                  <TableCell className="text-right">
                    {m.free ? (
                      <Badge className="bg-terminal-green/15 text-terminal-green border-terminal-green/30 text-xs">
                        Free
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        Paid
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4 text-purple-400" />
            Cortex LLM Models (Reasoning / Planning)
          </CardTitle>
          <CardDescription>
            Text-only reasoning models for the cortex planning layer and
            agentic loop.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Model</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Model ID</TableHead>
                <TableHead className="text-right">Tier</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cortexLlmOptions.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.label}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className="text-xs font-mono"
                    >
                      {m.provider}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground max-w-[200px] truncate">
                    {m.id}
                  </TableCell>
                  <TableCell className="text-right">
                    {m.free ? (
                      <Badge className="bg-terminal-green/15 text-terminal-green border-terminal-green/30 text-xs">
                        Free
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        Paid
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Provider info */}
      <div className="grid gap-3 sm:grid-cols-2">
        <ProviderCard
          name="Nebius Token Factory"
          description="High-throughput inference for Qwen and DeepSeek models. Set NEBIUS_API_KEY in your environment."
          envVar="NEBIUS_API_KEY"
        />
        <ProviderCard
          name="OpenRouter"
          description="Unified API gateway to 200+ models including free tiers. Set OPENROUTER_API_KEY in your environment."
          envVar="OPENROUTER_API_KEY"
        />
      </div>
    </div>
  );
}
