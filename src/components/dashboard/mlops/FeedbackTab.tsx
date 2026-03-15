import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { UseQueryResult } from "@tanstack/react-query";
import type { InferenceFailureAnnotation } from "@/types/mlops";

interface FeedbackTabProps {
  annotations: UseQueryResult<InferenceFailureAnnotation[]>;
}

export function FeedbackTab({ annotations }: FeedbackTabProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Inference Failure Annotations</CardTitle>
        </CardHeader>
        <CardContent>
          {annotations.data?.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Predicted</TableHead>
                  <TableHead>Correct</TableHead>
                  <TableHead>Annotator</TableHead>
                  <TableHead>Fed Back</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {annotations.data.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono text-xs">{a.id}</TableCell>
                    <TableCell className="font-mono">{a.model_key}</TableCell>
                    <TableCell className="font-mono">v{a.model_version}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{a.annotation_label}</Badge>
                    </TableCell>
                    <TableCell>{a.predicted_label || "—"}</TableCell>
                    <TableCell className="font-medium">{a.correct_label}</TableCell>
                    <TableCell>{a.annotator || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={a.fed_back ? "default" : "secondary"}>
                        {a.fed_back ? "Yes" : "Pending"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {new Date(a.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-sm">
              No annotations yet. Use <code>openeye mlops annotate</code> to add one.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
