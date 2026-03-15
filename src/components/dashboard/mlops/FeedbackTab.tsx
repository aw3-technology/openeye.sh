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
import type { InferenceFailureAnnotation, FeedbackBatch } from "@/types/mlops";

interface FeedbackTabProps {
  annotations: UseQueryResult<InferenceFailureAnnotation[]>;
  feedbackBatches: UseQueryResult<FeedbackBatch[]>;
}

export function FeedbackTab({ annotations, feedbackBatches }: FeedbackTabProps) {
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
                    <TableCell>{a.predicted_label || "\u2014"}</TableCell>
                    <TableCell className="font-medium">{a.correct_label}</TableCell>
                    <TableCell>{a.annotator || "\u2014"}</TableCell>
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

      <Card>
        <CardHeader>
          <CardTitle>Feedback Batches</CardTitle>
        </CardHeader>
        <CardContent>
          {feedbackBatches.data?.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Annotations</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Output Dataset</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Completed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {feedbackBatches.data.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-mono text-xs">{b.id}</TableCell>
                    <TableCell className="font-mono">{b.model_key}</TableCell>
                    <TableCell>{b.total_annotations}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          b.status === "completed"
                            ? "default"
                            : b.status === "failed"
                            ? "destructive"
                            : b.status === "running"
                            ? "secondary"
                            : "outline"
                        }
                      >
                        {b.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs max-w-[200px] truncate">
                      {b.output_dataset_path}
                    </TableCell>
                    <TableCell className="text-xs">
                      {new Date(b.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-xs">
                      {b.completed_at
                        ? new Date(b.completed_at).toLocaleDateString()
                        : "\u2014"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-sm">
              No feedback batches. Use <code>openeye mlops feedback</code> to create one.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
