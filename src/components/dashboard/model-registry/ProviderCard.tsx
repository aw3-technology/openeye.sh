import { Card, CardContent } from "@/components/ui/card";
import { Cloud } from "lucide-react";

export function ProviderCard({
  name,
  description,
  envVar,
}: {
  name: string;
  description: string;
  envVar: string;
}) {
  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Cloud className="h-4 w-4 text-terminal-amber" />
          <span className="text-sm font-medium">{name}</span>
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
        <code className="block text-xs font-mono bg-secondary text-oe-green px-2 py-1.5 rounded">
          export {envVar}="your-key-here"
        </code>
      </CardContent>
    </Card>
  );
}
