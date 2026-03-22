import { useState } from "react";
import { useApiKeys } from "@/hooks/useOpenEyeQueries";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Key, Shield, Zap } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { toastMutationError } from "@/lib/utils";
import { sha256, generateKey } from "@/lib/api-key-utils";
import { CodeBlock } from "@/components/ui/code-block";
import { KeysTable } from "@/components/dashboard/KeysTable";
import { CreateKeyDialog } from "@/components/dashboard/CreateKeyDialog";

export default function ApiKeys() {
  const { user } = useAuth();
  const { data: keys = [], isLoading } = useApiKeys();
  const qc = useQueryClient();
  const [quickStartTab, setQuickStartTab] = useState("curl");

  const handleCreate = async (name: string): Promise<string> => {
    if (!user) throw new Error("Not authenticated");
    const rawKey = generateKey();
    const hash = await sha256(rawKey);
    const prefix = rawKey.slice(0, 7);

    const { error } = await supabase
      .from("api_keys" as any)
      .insert({ user_id: user.id, name, key_prefix: prefix, key_hash: hash });

    if (error) throw error;
    qc.invalidateQueries({ queryKey: ["openeye", "api_keys"] });
    return rawKey;
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from("api_keys" as any)
      .delete()
      .eq("id", id);
    if (error) {
      toastMutationError("Key deletion", error);
      return;
    }
    toast.success("Key deleted");
    qc.invalidateQueries({ queryKey: ["openeye", "api_keys"] });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">API Keys</h1>
          <p className="text-sm text-muted-foreground">
            Manage keys for authenticating with the OpenEye inference API.
          </p>
        </div>
        <CreateKeyDialog onGenerate={handleCreate} />
      </div>

      {/* Keys table */}
      <KeysTable keys={keys} isLoading={isLoading} onDelete={handleDelete} />

      {/* Quick Start */}
      <div>
        <h2 className="mb-3 text-lg font-medium">Quick Start</h2>
        <Card>
          <CardContent className="pt-6">
            <Tabs value={quickStartTab} onValueChange={setQuickStartTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="curl">cURL</TabsTrigger>
                <TabsTrigger value="python">Python</TabsTrigger>
                <TabsTrigger value="javascript">JavaScript</TabsTrigger>
                <TabsTrigger value="websocket">WebSocket</TabsTrigger>
              </TabsList>
              <TabsContent value="curl">
                <CodeBlock
                  code={`curl -X POST https://api.openeye.ai/v1/detect \\
  -H "X-API-Key: oe_your_key_here" \\
  -F "file=@photo.jpg" \\
  -F "confidence=0.3"`}
                />
              </TabsContent>
              <TabsContent value="python">
                <CodeBlock
                  lang="python"
                  code={`import requests

resp = requests.post(
    "https://api.openeye.ai/v1/detect",
    headers={"X-API-Key": "oe_your_key_here"},
    files={"file": open("photo.jpg", "rb")},
    data={"confidence": 0.3},
)
detections = resp.json()["objects"]
for obj in detections:
    print(f"{obj['label']}: {obj['confidence']:.0%}")`}
                />
              </TabsContent>
              <TabsContent value="javascript">
                <CodeBlock
                  lang="javascript"
                  code={`const form = new FormData();
form.append("file", imageBlob, "photo.jpg");

const res = await fetch("https://api.openeye.ai/v1/detect", {
  method: "POST",
  headers: { "X-API-Key": "oe_your_key_here" },
  body: form,
});
const { objects } = await res.json();
objects.forEach(o => console.log(\`\${o.label}: \${o.confidence}\`));`}
                />
              </TabsContent>
              <TabsContent value="websocket">
                <CodeBlock
                  lang="javascript"
                  code={`const ws = new WebSocket("wss://api.openeye.ai/ws/perception");

ws.onopen = () => {
  ws.send(JSON.stringify({ api_key: "oe_your_key_here" }));
};

ws.onmessage = (event) => {
  const frame = JSON.parse(event.data);
  console.log("Detections:", frame.objects);
};

// Send frames as base64
ws.send(JSON.stringify({ image: base64Frame }));`}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Security & Best Practices */}
      <div>
        <h2 className="mb-3 text-lg font-medium">Security & Best Practices</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardContent className="flex items-start gap-3 pt-6">
              <div className="rounded-md bg-green-500/10 p-2 shrink-0">
                <Shield className="h-4 w-4 text-green-500" />
              </div>
              <div>
                <p className="text-sm font-medium mb-1">Keep keys secret</p>
                <p className="text-xs text-muted-foreground">
                  Store keys in environment variables or a secrets manager.
                  Never commit them to source control.
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-start gap-3 pt-6">
              <div className="rounded-md bg-blue-500/10 p-2 shrink-0">
                <Key className="h-4 w-4 text-blue-500" />
              </div>
              <div>
                <p className="text-sm font-medium mb-1">Use separate keys</p>
                <p className="text-xs text-muted-foreground">
                  Create distinct keys for each environment or service.
                  Revoke individual keys without affecting others.
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-start gap-3 pt-6">
              <div className="rounded-md bg-amber-500/10 p-2 shrink-0">
                <Zap className="h-4 w-4 text-amber-500" />
              </div>
              <div>
                <p className="text-sm font-medium mb-1">Rotate regularly</p>
                <p className="text-xs text-muted-foreground">
                  Rotate keys periodically and immediately if you suspect
                  a key has been compromised.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Authentication methods */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Authentication Methods</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <Badge variant="outline" className="shrink-0 mt-0.5 font-mono text-xs">
                Header
              </Badge>
              <div>
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                  X-API-Key: oe_your_key_here
                </code>
                <p className="text-xs text-muted-foreground mt-1">
                  Recommended for REST API requests.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="outline" className="shrink-0 mt-0.5 font-mono text-xs">
                Bearer
              </Badge>
              <div>
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                  Authorization: Bearer oe_your_key_here
                </code>
                <p className="text-xs text-muted-foreground mt-1">
                  Standard OAuth-style bearer token format.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="outline" className="shrink-0 mt-0.5 font-mono text-xs">
                WebSocket
              </Badge>
              <div>
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                  {`{"api_key": "oe_your_key_here"}`}
                </code>
                <p className="text-xs text-muted-foreground mt-1">
                  Send as the first message after connecting.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
