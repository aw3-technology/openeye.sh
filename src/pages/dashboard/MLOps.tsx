import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useOpenEyeConnection } from "@/hooks/useOpenEyeConnection";
import {
  useModels,
  usePromotions,
  useABTests,
  useRetrainingRuns,
  useBatchJobs,
  useShadowDeployments,
  useAnnotations,
  useValidationRuns,
  useExports,
} from "@/hooks/useMLOpsQueries";
import { RegistryTab } from "@/components/dashboard/mlops/RegistryTab";
import { LifecycleTab } from "@/components/dashboard/mlops/LifecycleTab";
import { ABTestingTab } from "@/components/dashboard/mlops/ABTestingTab";
import { OperationsTab } from "@/components/dashboard/mlops/OperationsTab";
import { ShadowTab } from "@/components/dashboard/mlops/ShadowTab";
import { FeedbackTab } from "@/components/dashboard/mlops/FeedbackTab";

export default function MLOps() {
  const { client } = useOpenEyeConnection();
  const baseUrl = (client?.baseUrl ?? "").replace(/\/+$/, "");

  const models = useModels(baseUrl);
  const promotions = usePromotions(baseUrl);
  const abTests = useABTests(baseUrl);
  const retrainingRuns = useRetrainingRuns(baseUrl);
  const batchJobs = useBatchJobs(baseUrl);
  const shadowDeps = useShadowDeployments(baseUrl);
  const annotations = useAnnotations(baseUrl);
  const validationRuns = useValidationRuns(baseUrl);
  const exports = useExports(baseUrl);

  const queryError = models.error || abTests.error || shadowDeps.error;

  if (!baseUrl) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Connect to an OpenEye server to view MLOps dashboard.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Model Lifecycle & MLOps</h1>
        {models.isLoading && (
          <span className="text-sm text-muted-foreground">Loading...</span>
        )}
        {queryError && (
          <span className="text-sm text-destructive">
            Failed to load data. Is the server running?
          </span>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Registered Models
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{models.data?.length ?? "—"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active A/B Tests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {abTests.data?.filter((t) => t.status === "running").length ?? "—"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Shadow Deployments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {shadowDeps.data?.filter((d) => d.status === "active").length ?? "—"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending Annotations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {annotations.data?.filter((a) => !a.fed_back).length ?? "—"}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="registry" className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="registry">Registry</TabsTrigger>
          <TabsTrigger value="lifecycle">Lifecycle</TabsTrigger>
          <TabsTrigger value="ab-testing">A/B Tests</TabsTrigger>
          <TabsTrigger value="operations">Operations</TabsTrigger>
          <TabsTrigger value="shadow">Shadow</TabsTrigger>
          <TabsTrigger value="feedback">Feedback</TabsTrigger>
        </TabsList>

        <TabsContent value="registry">
          <RegistryTab models={models} exports={exports} />
        </TabsContent>
        <TabsContent value="lifecycle">
          <LifecycleTab promotions={promotions} validationRuns={validationRuns} />
        </TabsContent>
        <TabsContent value="ab-testing">
          <ABTestingTab abTests={abTests} />
        </TabsContent>
        <TabsContent value="operations">
          <OperationsTab retrainingRuns={retrainingRuns} batchJobs={batchJobs} />
        </TabsContent>
        <TabsContent value="shadow">
          <ShadowTab shadowDeps={shadowDeps} />
        </TabsContent>
        <TabsContent value="feedback">
          <FeedbackTab annotations={annotations} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
