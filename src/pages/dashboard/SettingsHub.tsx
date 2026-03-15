import { useLocation, useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileCode, Key, Coins } from "lucide-react";
import ConfigEditor from "./ConfigEditor";
import ApiKeys from "./ApiKeys";
import Credits from "./Credits";

const TAB_MAP: Record<string, string> = {
  "/dashboard/settings": "config",
  "/dashboard/settings/api-keys": "api-keys",
  "/dashboard/settings/credits": "credits",
};

const PATH_MAP: Record<string, string> = {
  config: "/dashboard/settings",
  "api-keys": "/dashboard/settings/api-keys",
  credits: "/dashboard/settings/credits",
};

export default function SettingsHub() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeTab = TAB_MAP[location.pathname] || "config";

  return (
    <Tabs
      value={activeTab}
      onValueChange={(tab) => navigate(PATH_MAP[tab], { replace: true })}
    >
      <TabsList>
        <TabsTrigger value="config" className="gap-1.5">
          <FileCode className="h-3.5 w-3.5" />
          Config
        </TabsTrigger>
        <TabsTrigger value="api-keys" className="gap-1.5">
          <Key className="h-3.5 w-3.5" />
          API Keys
        </TabsTrigger>
        <TabsTrigger value="credits" className="gap-1.5">
          <Coins className="h-3.5 w-3.5" />
          Credits
        </TabsTrigger>
      </TabsList>
      <TabsContent value="config" className="mt-6">
        <ConfigEditor />
      </TabsContent>
      <TabsContent value="api-keys" className="mt-6">
        <ApiKeys />
      </TabsContent>
      <TabsContent value="credits" className="mt-6">
        <Credits />
      </TabsContent>
    </Tabs>
  );
}
