import { modelGroups, type Model } from "./modelsData";

/**
 * Models the `openeye` CLI can pull today, mirrored from
 * cli/openeye_ai/models.yaml. Each one gets a landing page at /models/:slug.
 */
export interface RegistryModel {
  /** CLI id, used in `openeye pull <slug>` and the page URL. */
  slug: string;
  name: string;
  task: "detection" | "depth" | "segmentation" | "vla";
  summary: string;
  hfRepo: string;
  sizeMb: number;
  hardware: { cpu: boolean; cuda: boolean; mps: boolean };
  /** pipx extra that installs this model's runtime dependencies. */
  extra: string;
  /** Example `openeye run` invocation for this model. */
  runExample: string;
  /** Search-oriented phrase used in the page title, e.g. "object detection". */
  keyword: string;
}

export const registryModels: RegistryModel[] = [
  {
    slug: "yolov8",
    name: "YOLOv8",
    task: "detection",
    summary: "Real-time object detection with 80 COCO classes.",
    hfRepo: "ultralytics/yolov8",
    sizeMb: 6,
    hardware: { cpu: true, cuda: true, mps: true },
    extra: "yolo",
    runExample: "openeye run yolov8 photo.jpg --pretty",
    keyword: "real-time object detection",
  },
  {
    slug: "yolo26",
    name: "YOLO26",
    task: "detection",
    summary: "Latest YOLO generation with 80 COCO classes, optimized for speed.",
    hfRepo: "ultralytics/yolo11",
    sizeMb: 5,
    hardware: { cpu: true, cuda: true, mps: true },
    extra: "yolo",
    runExample: "openeye run yolo26 photo.jpg --pretty",
    keyword: "fast object detection",
  },
  {
    slug: "rfdetr",
    name: "RF-DETR",
    task: "detection",
    summary: "Real-time detection transformer without NMS post-processing.",
    hfRepo: "rfdetr/rfdetr-base",
    sizeMb: 120,
    hardware: { cpu: true, cuda: true, mps: false },
    extra: "rfdetr",
    runExample: "openeye run rfdetr photo.jpg --pretty",
    keyword: "transformer object detection",
  },
  {
    slug: "grounding-dino",
    name: "Grounding DINO",
    task: "detection",
    summary: "Open-vocabulary object detection from text prompts.",
    hfRepo: "IDEA-Research/grounding-dino-tiny",
    sizeMb: 341,
    hardware: { cpu: true, cuda: true, mps: false },
    extra: "grounding",
    runExample: 'openeye run grounding-dino image.jpg --prompt "red cup"',
    keyword: "open-vocabulary object detection",
  },
  {
    slug: "depth-anything",
    name: "Depth Anything V2",
    task: "depth",
    summary: "Monocular depth estimation from a single camera.",
    hfRepo: "depth-anything/Depth-Anything-V2-Small-hf",
    sizeMb: 98,
    hardware: { cpu: true, cuda: true, mps: true },
    extra: "depth",
    runExample: "openeye run depth-anything scene.png --visualize",
    keyword: "monocular depth estimation",
  },
  {
    slug: "sam2",
    name: "SAM 2",
    task: "segmentation",
    summary: "Zero-shot segmentation via Segment Anything 2.",
    hfRepo: "facebook/sam2-hiera-small",
    sizeMb: 150,
    hardware: { cpu: true, cuda: true, mps: true },
    extra: "sam",
    runExample: "openeye run sam2 photo.jpg --pretty",
    keyword: "zero-shot image segmentation",
  },
  {
    slug: "smolvla",
    name: "SmolVLA",
    task: "vla",
    summary: "Vision-language-action model for robotic control.",
    hfRepo: "HuggingFaceTB/SmolVLA-base",
    sizeMb: 500,
    hardware: { cpu: true, cuda: true, mps: false },
    extra: "smolvla",
    runExample: "openeye run smolvla frame.jpg --pretty",
    keyword: "vision-language-action for robots",
  },
];

export const taskLabels: Record<RegistryModel["task"], string> = {
  detection: "Object detection",
  depth: "Depth estimation",
  segmentation: "Segmentation",
  vla: "Vision-language-action",
};

export function getRegistryModel(slug: string): RegistryModel | undefined {
  return registryModels.find((m) => m.slug === slug);
}

/** Catalog entry (creator, long description) for a registry model, if any. */
export function getCatalogModel(name: string): Model | undefined {
  for (const group of modelGroups) {
    const found = group.models.find((m) => m.name === name);
    if (found) return found;
  }
  return undefined;
}

/** Registry slug for a catalog model name, so catalog cards can link to it. */
export function slugForModelName(name: string): string | undefined {
  return registryModels.find((m) => m.name === name)?.slug;
}
