import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MetricCard } from "@/components/dashboard/MetricCard";
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
  useLineage,
  useFeedbackBatches,
} from "@/hooks/useMLOpsQueries";

import { RegistryTab } from "@/components/dashboard/mlops/RegistryTab";
import { LifecycleTab } from "@/components/dashboard/mlops/LifecycleTab";
import { ABTestingTab } from "@/components/dashboard/mlops/ABTestingTab";
import { OperationsTab } from "@/components/dashboard/mlops/OperationsTab";
import { ShadowTab } from "@/components/dashboard/mlops/ShadowTab";
import { FeedbackTab } from "@/components/dashboard/mlops/FeedbackTab";
import { LineageTab } from "@/components/dashboard/mlops/LineageTab";
import {
  FlaskConical,
  Package,
  GitCompare,
  Eye,
  MessageSquare,
  GitBranch,
  Cog,
  ArrowUpDown,
} from "lucide-react";

export default function MLOps() {
  const { isConnected } = useOpenEyeConnection();

  const models = useModels();
  const promotions = usePromotions();
  const abTests = useABTests();
  const retrainingRuns = useRetrainingRuns();
  const batchJobs = useBatchJobs();
  const shadowDeps = useShadowDeployments();
  const annotations = useAnnotations();
  const validationRuns = useValidationRuns();
  const exports = useExports();
  const lineage = useLineage();
  const feedbackBatches = useFeedbackBatches();

  const queryError = models.error || abTests.error || shadowDeps.error;

  if (!isConnected) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Connect to an OpenEye server to view MLOps dashboard.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FlaskConical className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold">Model Lifecycle & MLOps</h1>
            <p className="text-sm text-muted-foreground">
              Registry, A/B testing, shadow deployments, retraining, and model lineage
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {models.isLoading && (
            <span className="text-sm text-muted-foreground">Loading...</span>
          )}
          {queryError && (
            <span className="text-sm text-destructive">
              Failed to load data. Is the server running?
            </span>
          )}
        </div>
      </div>

      {/* Summary metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Registered Models"
          value={models.data?.length ?? "\u2014"}
          icon={Package}
          color="bg-blue-500/15 text-blue-500"
        />
        <MetricCard
          label="Active A/B Tests"
          value={abTests.data?.filter((t) => t.status === "running").length ?? "\u2014"}
          icon={GitCompare}
          color="bg-purple-500/15 text-purple-500"
        />
        <MetricCard
          label="Shadow Deployments"
          value={shadowDeps.data?.filter((d) => d.status === "active").length ?? "\u2014"}
          icon={Eye}
          color="bg-teal-500/15 text-teal-500"
        />
        <MetricCard
          label="Pending Annotations"
          value={annotations.data?.filter((a) => !a.fed_back).length ?? "\u2014"}
          icon={MessageSquare}
          color="bg-yellow-500/15 text-yellow-500"
        />
      </div>

      <Tabs defaultValue="registry" className="space-y-4">
        <TabsList className="flex w-full overflow-x-auto">
          <TabsTrigger value="registry" className="flex-1 min-w-0">
            Registry
          </TabsTrigger>
          <TabsTrigger value="lifecycle" className="flex-1 min-w-0">
            Lifecycle
          </TabsTrigger>
          <TabsTrigger value="ab-testing" className="flex-1 min-w-0">
            A/B Tests
          </TabsTrigger>
          <TabsTrigger value="operations" className="flex-1 min-w-0">
            Operations
          </TabsTrigger>
          <TabsTrigger value="shadow" className="flex-1 min-w-0">
            Shadow
          </TabsTrigger>
          <TabsTrigger value="lineage" className="flex-1 min-w-0">
            Lineage
          </TabsTrigger>
          <TabsTrigger value="feedback" className="flex-1 min-w-0">
            Feedback
          </TabsTrigger>
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
        <TabsContent value="lineage">
          <LineageTab lineage={lineage} />
        </TabsContent>
        <TabsContent value="feedback">
          <FeedbackTab annotations={annotations} feedbackBatches={feedbackBatches} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
