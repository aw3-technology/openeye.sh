export type { Model, ModelGroup, ProductionModel } from "./types";
export { perceptionModelGroups } from "./perceptionModels";
export { intelligenceModelGroups } from "./intelligenceModels";
export { productionModels } from "./production";

import { perceptionModelGroups } from "./perceptionModels";
import { intelligenceModelGroups } from "./intelligenceModels";
import type { ModelGroup } from "./types";

export const modelGroups: ModelGroup[] = [
  ...perceptionModelGroups.slice(0, 2),   // Detection, Segmentation
  ...intelligenceModelGroups.slice(0, 5), // VLM, LLM, Safety, Embeddings, Agentic
  ...perceptionModelGroups.slice(2),      // Frameworks, Depth
  ...intelligenceModelGroups.slice(5),    // Video, VLA
];
