import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/data-states";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Key, Trash2 } from "lucide-react";
import { format } from "date-fns";

export interface KeysTableProps {
  keys: Array<{
    id: string;
    name: string;
    key_prefix: string;
    created_at: string;
    last_used_at: string | null;
  }>;
  isLoading: boolean;
  onDelete: (id: string) => void;
}

export function KeysTable({ keys, isLoading, onDelete }: KeysTableProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Your Keys</CardTitle>
        {keys.length > 0 && (
          <Badge variant="secondary" className="tabular-nums">
            {keys.length}
          </Badge>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <LoadingState />
        ) : keys.length === 0 ? (
          <div className="py-8 text-center">
            <Key className="mx-auto h-8 w-8 text-muted-foreground/50 mb-3" />
            <p className="text-sm font-medium mb-1">No API keys yet</p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Create your first key to authenticate programmatic access to the
              OpenEye detection and perception APIs.
            </p>
          </div>
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
                  <TableCell className="text-sm font-medium">{key.name}</TableCell>
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
                            This will permanently revoke the key "{key.name}". Any
                            applications using this key will lose access immediately.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => onDelete(key.id)}>
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
  );
}
