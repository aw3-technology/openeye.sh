import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowRight,
  Bot,
  ImagePlus,
  Radio,
  Video,
} from "lucide-react";

const quickActions = [
  { label: "Inference", icon: ImagePlus, path: "/dashboard/inference", description: "Run model predictions" },
  { label: "Live Stream", icon: Video, path: "/dashboard/live", description: "Camera feed + detection" },
  { label: "Agent Loop", icon: Bot, path: "/dashboard/agent", description: "Perception + reasoning" },
  { label: "Fleet", icon: Radio, path: "/dashboard/fleet", description: "Manage edge devices" },
] as const;

export function OverviewQuickActions() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {quickActions.map(({ label, icon: Icon, path, description }) => (
        <Link key={path} to={path}>
          <Card className="transition-colors hover:bg-muted/50 cursor-pointer h-full">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="rounded-md bg-primary/10 p-2">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground truncate">{description}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
