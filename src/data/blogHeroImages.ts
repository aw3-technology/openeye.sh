// Hero image mapping for blog posts — keyed by slug
// Images are imported as ES6 modules for proper bundling

import safetySystems from "@/assets/blog/safety-systems.jpg";
import sixLayers from "@/assets/blog/six-layers.jpg";
import originStory from "@/assets/blog/origin-story.jpg";
import modelAgnostic from "@/assets/blog/model-agnostic.jpg";
import onePipeline from "@/assets/blog/one-pipeline.jpg";
import vsProprietary from "@/assets/blog/vs-proprietary.jpg";
import perceptionInfrastructure from "@/assets/blog/perception-infrastructure.jpg";
import grpcStreaming from "@/assets/blog/grpc-streaming.jpg";
import twoBrain from "@/assets/blog/two-brain.jpg";
import cliInstead from "@/assets/blog/cli-instead.jpg";
import safetyCrisis from "@/assets/blog/safety-crisis.jpg";
import openSourcePerception from "@/assets/blog/open-source-perception.jpg";
import persistentMemory from "@/assets/blog/persistent-memory.jpg";

export const blogHeroImages: Record<string, string> = {
  "building-safety-systems-that-actually-stop-the-robot": safetySystems,
  "from-camera-to-action-in-six-layers": sixLayers,
  "from-hackathon-to-open-source-the-openeye-origin-story": originStory,
  "model-agnostic-perception-future-proofing-your-robot": modelAgnostic,
  "one-pipeline-every-robot": onePipeline,
  "openeye-vs-proprietary-vision-stacks": vsProprietary,
  "perception-as-infrastructure": perceptionInfrastructure,
  "real-time-perception-streaming-with-grpc": grpcStreaming,
  "two-brain-architecture-yolo-meets-vlm": twoBrain,
  "why-we-built-a-cli-instead-of-a-dashboard": cliInstead,
  "the-safety-crisis-no-one-in-robotics-is-talking-about": safetyCrisis,
  "why-robot-perception-needs-to-be-open-source": openSourcePerception,
  "why-robots-forget-and-how-persistent-memory-changes-everything": persistentMemory,
};
