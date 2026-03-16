import { TitleSlide } from "./TitleSlide";
import { ProblemSlide } from "./ProblemSlide";
import { SolutionSlide } from "./SolutionSlide";
import { ArchitectureSlide } from "./ArchitectureSlide";
import { ModelsSlide } from "./ModelsSlide";
import { SafetySlide } from "./SafetySlide";
import { AgenticSlide } from "./AgenticSlide";
import { GovernanceSlide } from "./GovernanceSlide";
import { PluginSlide } from "./PluginSlide";
import { DeploySlide } from "./DeploySlide";
import { UseCasesSlide } from "./UseCasesSlide";
import { CTASlide } from "./CTASlide";

export { ScaledSlide } from "./components";

export interface SlideData {
  id: string;
  content: React.ReactNode;
}

export const slides: SlideData[] = [
  { id: "title", content: <TitleSlide /> },
  { id: "problem", content: <ProblemSlide /> },
  { id: "solution", content: <SolutionSlide /> },
  { id: "architecture", content: <ArchitectureSlide /> },
  { id: "models", content: <ModelsSlide /> },
  { id: "safety", content: <SafetySlide /> },
  { id: "agentic", content: <AgenticSlide /> },
  { id: "governance", content: <GovernanceSlide /> },
  { id: "plugins", content: <PluginSlide /> },
  { id: "deploy", content: <DeploySlide /> },
  { id: "use-cases", content: <UseCasesSlide /> },
  { id: "cta", content: <CTASlide /> },
];
