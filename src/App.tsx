import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { OpenEyeConnectionProvider } from "@/hooks/useOpenEyeConnection";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DashboardErrorBoundary } from "@/components/DashboardErrorBoundary";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import Index from "./pages/Index.tsx";
import Login from "./pages/Login.tsx";
import Blog from "./pages/Blog.tsx";
import BlogPost from "./pages/BlogPost.tsx";
import Changelog from "./pages/Changelog.tsx";
import Community from "./pages/Community.tsx";
import UseCases from "./pages/UseCases.tsx";
import About from "./pages/About.tsx";
import Docs from "./pages/Docs.tsx";
import Pricing from "./pages/Pricing.tsx";
import Models from "./pages/Models.tsx";
import Architecture from "./pages/Architecture.tsx";
import NotFound from "./pages/NotFound.tsx";
import Overview from "./pages/dashboard/Overview.tsx";
import Inference from "./pages/dashboard/Inference.tsx";
import LiveStream from "./pages/dashboard/LiveStream.tsx";
import History from "./pages/dashboard/History.tsx";
import ModelSettings from "./pages/dashboard/ModelSettings.tsx";
import ModelRegistry from "./pages/dashboard/ModelRegistry.tsx";
import BenchmarkPage from "./pages/dashboard/Benchmark.tsx";
import Metrics from "./pages/dashboard/Metrics.tsx";
import Export from "./pages/dashboard/Export.tsx";
import ApiKeys from "./pages/dashboard/ApiKeys.tsx";
import ConfigEditor from "./pages/dashboard/ConfigEditor.tsx";
import SceneGraphPage from "./pages/dashboard/SceneGraph.tsx";
import MLOps from "./pages/dashboard/MLOps.tsx";
import Credits from "./pages/dashboard/Credits.tsx";
import AgentLoop from "./pages/dashboard/AgentLoop.tsx";
import MemoryPage from "./pages/dashboard/Memory.tsx";
import FleetDashboard from "./pages/dashboard/fleet/FleetDashboard.tsx";
import DeviceDetail from "./pages/dashboard/fleet/DeviceDetail.tsx";
import Deployments from "./pages/dashboard/fleet/Deployments.tsx";
import DeploymentDetail from "./pages/dashboard/fleet/DeploymentDetail.tsx";
import DeviceGroups from "./pages/dashboard/fleet/DeviceGroups.tsx";
import MaintenancePage from "./pages/dashboard/fleet/Maintenance.tsx";
import FleetAlerts from "./pages/dashboard/fleet/FleetAlerts.tsx";
import Demo from "./pages/dashboard/Demo.tsx";
import AgenticDemo from "./pages/dashboard/AgenticDemo.tsx";
import Governance from "./pages/dashboard/Governance.tsx";
import Presentation from "./pages/Presentation.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/blog" element={<Blog />} />
            <Route path="/blog/:slug" element={<BlogPost />} />
            <Route path="/changelog" element={<Changelog />} />
            <Route path="/community" element={<Community />} />
            <Route path="/use-cases" element={<UseCases />} />
            <Route path="/about" element={<About />} />
            <Route path="/docs" element={<Docs />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/models" element={<Models />} />
            <Route path="/architecture" element={<Architecture />} />

            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardErrorBoundary>
                    <OpenEyeConnectionProvider>
                      <DashboardLayout />
                    </OpenEyeConnectionProvider>
                  </DashboardErrorBoundary>
                </ProtectedRoute>
              }
            >
              <Route index element={<Overview />} />
              <Route path="demo" element={<Demo />} />
              <Route path="inference" element={<Inference />} />
              <Route path="live" element={<LiveStream />} />
              <Route path="history" element={<History />} />
              <Route path="settings" element={<ModelSettings />} />
              <Route path="models" element={<ModelRegistry />} />
              <Route path="benchmark" element={<BenchmarkPage />} />
              <Route path="metrics" element={<Metrics />} />
              <Route path="scene-graph" element={<SceneGraphPage />} />
              <Route path="export" element={<Export />} />
              <Route path="api-keys" element={<ApiKeys />} />
              <Route path="config" element={<ConfigEditor />} />
              <Route path="mlops" element={<MLOps />} />
              <Route path="credits" element={<Credits />} />
              <Route path="agent" element={<AgentLoop />} />
              <Route path="memory" element={<MemoryPage />} />
              <Route path="agentic" element={<AgenticDemo />} />
              <Route path="fleet" element={<FleetDashboard />} />
              <Route path="fleet/devices/:deviceId" element={<DeviceDetail />} />
              <Route path="fleet/deployments" element={<Deployments />} />
              <Route path="fleet/deployments/:id" element={<DeploymentDetail />} />
              <Route path="fleet/groups" element={<DeviceGroups />} />
              <Route path="fleet/maintenance" element={<MaintenancePage />} />
              <Route path="fleet/alerts" element={<FleetAlerts />} />
              <Route path="governance" element={<Governance />} />
              <Route path="*" element={<NotFound />} />
            </Route>

            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
