import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { CheckCircle2, Circle, Clock, Info } from "lucide-react";
import type { ModelEntry } from "./types";

function StatusIcon({
  status,
  downloaded,
}: {
  status: "integrated" | "planned";
  downloaded: boolean;
}) {
  if (downloaded) {
    return <CheckCircle2 className="h-4 w-4 text-terminal-green" />;
  }
  if (status === "integrated") {
    return <Circle className="h-4 w-4 text-terminal-green/50" />;
  }
  return <Clock className="h-4 w-4 text-muted-foreground" />;
}

interface ModelDetailPanelProps {
  models: ModelEntry[];
}

export function ModelDetailPanel({ models }: ModelDetailPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Info className="h-4 w-4" />
          Model Details
        </CardTitle>
        <CardDescription>
          Expand a model to see its description, performance, and install
          command.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
          {models.map((model) => (
            <AccordionItem key={model.key} value={model.key}>
              <AccordionTrigger className="text-sm hover:no-underline">
                <div className="flex items-center gap-3 text-left">
                  <StatusIcon
                    status={model.status}
                    downloaded={model.downloaded}
                  />
                  <span className="font-medium">{model.name}</span>
                  <span className="text-xs text-muted-foreground hidden sm:inline">
                    {model.creator}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 pl-7">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {model.description}
                  </p>

                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="text-xs font-mono">
                      {model.category}
                    </Badge>
                    <Badge
                      variant={
                        model.status === "integrated"
                          ? "default"
                          : "secondary"
                      }
                      className="text-xs"
                    >
                      {model.status}
                    </Badge>
                    {model.performance && (
                      <Badge
                        variant="outline"
                        className="text-xs text-terminal-green border-terminal-green/30"
                      >
                        {model.performance}
                      </Badge>
                    )}
                    {model.provider && (
                      <Badge
                        variant="outline"
                        className="text-xs text-terminal-amber border-terminal-amber/30"
                      >
                        {model.provider}
                      </Badge>
                    )}
                    {model.size_mb && (
                      <Badge variant="outline" className="text-xs font-mono">
                        {model.size_mb >= 1000
                          ? `${(model.size_mb / 1000).toFixed(1)} GB`
                          : `${model.size_mb} MB`}
                      </Badge>
                    )}
                  </div>

                  {model.status === "integrated" && (
                    <div className="space-y-1.5">
                      <code className="block text-xs font-mono bg-secondary text-oe-green px-3 py-2 rounded">
                        $ openeye pull {model.key}
                      </code>
                      <code className="block text-xs font-mono bg-secondary text-oe-green px-3 py-2 rounded">
                        $ openeye run {model.key} image.jpg
                      </code>
                      {model.extras && (
                        <code className="block text-xs font-mono bg-secondary text-muted-foreground px-3 py-2 rounded">
                          $ {model.extras}
                        </code>
                      )}
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}
