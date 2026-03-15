import { useApiKeys } from "@/hooks/useOpenEyeQueries";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState, EmptyState } from "@/components/ui/data-states";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Trash2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { toastMutationError } from "@/lib/utils";
import { CreateKeyDialog } from "@/components/dashboard/CreateKeyDialog";

async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateKey(): string {
  const prefix = "oe_";
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return prefix + hex;
}

export default function ApiKeys() {
  const { user } = useAuth();
  const { data: keys = [], isLoading } = useApiKeys();
  const qc = useQueryClient();

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
      .from("api_keys")
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">API Keys</h1>
        <CreateKeyDialog onGenerate={handleCreate} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your Keys</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingState />
          ) : keys.length === 0 ? (
            <EmptyState message="No API keys yet. API keys authenticate programmatic access to the OpenEye inference API." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Prefix</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="text-sm">{key.name}</TableCell>
                    <TableCell className="font-mono text-xs">{key.key_prefix}...</TableCell>
                    <TableCell className="text-xs tabular-nums">
                      {format(new Date(key.created_at), "yyyy-MM-dd")}
                    </TableCell>
                    <TableCell className="text-xs tabular-nums text-muted-foreground">
                      {key.last_used_at
                        ? format(new Date(key.last_used_at), "yyyy-MM-dd")
                        : "Never"}
                    </TableCell>
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Delete key ${key.name}`}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete API Key</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently revoke the key "{key.name}". This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(key.id)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
