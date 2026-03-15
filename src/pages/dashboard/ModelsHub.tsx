import { useLocation, useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Cpu, SlidersHorizontal, Gauge } from "lucide-react";
import ModelRegistry from "./ModelRegistry";
import ModelSettings from "./ModelSettings";
import Benchmark from "./Benchmark";

const TAB_MAP: Record<string, string> = {
  "/dashboard/models": "registry",
  "/dashboard/models/settings": "settings",
  "/dashboard/models/benchmark": "benchmark",
};

const PATH_MAP: Record<string, string> = {
  registry: "/dashboard/models",
  settings: "/dashboard/models/settings",
  benchmark: "/dashboard/models/benchmark",
};

export default function ModelsHub() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeTab = TAB_MAP[location.pathname] || "registry";

  return (
    <Tabs
      value={activeTab}
      onValueChange={(tab) => navigate(PATH_MAP[tab], { replace: true })}
    >
      <TabsList>
        <TabsTrigger value="registry" className="gap-1.5">
          <Cpu className="h-3.5 w-3.5" />
          Registry
        </TabsTrigger>
        <TabsTrigger value="settings" className="gap-1.5">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Settings
        </TabsTrigger>
        <TabsTrigger value="benchmark" className="gap-1.5">
          <Gauge className="h-3.5 w-3.5" />
          Benchmark
        </TabsTrigger>
      </TabsList>
      <TabsContent value="registry" className="mt-6">
        <ModelRegistry />
      </TabsContent>
      <TabsContent value="settings" className="mt-6">
        <ModelSettings />
      </TabsContent>
      <TabsContent value="benchmark" className="mt-6">
        <Benchmark />
      </TabsContent>
    </Tabs>
  );
}
