export interface PricingFeature {
  text: string;
  included: boolean;
}

export interface PricingPlanTier {
  name: string;
  price: string;
  description: string;
  cta: string;
  ctaHref: string;
  highlighted?: boolean;
  badge?: string;
  features: PricingFeature[];
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface CompetitorFeature {
  label: string;
  openeye: string | boolean;
  competitors: Record<string, string | boolean>;
}

export const pricingTiers: PricingPlanTier[] = [
  {
    name: "Open Source",
    price: "Free forever",
    description:
      "Self-hosted CLI with the full perception stack. Run on your own hardware, no strings attached.",
    cta: "Get Started",
    ctaHref: "/docs#installation",
    highlighted: true,
    badge: "Available Now",
    features: [
      { text: "Full CLI toolchain (run, serve, watch, bench)", included: true },
      { text: "8 model adapters (YOLO, RF-DETR, DINO, SAM 2, Depth, SmolVLA, Qwen2.5-VL)", included: true },
      { text: "Dual-layer perception (YOLO + VLM reasoning)", included: true },
      { text: "REST & WebSocket API server", included: true },
      { text: "Real-time dashboard with 19+ pages", included: true },
      { text: "Scene graph generation & spatial reasoning", included: true },
      { text: "MLOps pipeline (registry, A/B testing, shadow deploys)", included: true },
      { text: "Fleet management CLI", included: true },
      { text: "Safety governance framework", included: true },
      { text: "GPU acceleration (CUDA + Apple MPS)", included: true },
      { text: "Apache 2.0 license", included: true },
      { text: "Community support (GitHub)", included: true },
    ],
  },
  {
    name: "Cloud",
    price: "Coming Soon",
    description:
      "Hosted inference API — no GPU management required. All the power, none of the ops.",
    cta: "Join Waitlist",
    ctaHref: "mailto:hello@openeye.sh",
    features: [
      { text: "Everything in Open Source", included: true },
      { text: "Hosted inference API", included: true },
      { text: "Nebius VLM Token Factory (managed)", included: true },
      { text: "API key management & credits", included: true },
      { text: "Usage dashboard & analytics", included: true },
      { text: "Managed model updates & patches", included: true },
      { text: "Email support", included: true },
      { text: "Custom model deployment", included: false },
    ],
  },
  {
    name: "Enterprise",
    price: "Contact Us",
    description:
      "Managed deployment with custom models, dedicated infrastructure, and fleet-scale ops.",
    cta: "Contact Sales",
    ctaHref: "mailto:sales@openeye.sh",
    features: [
      { text: "Everything in Cloud", included: true },
      { text: "Custom model training & fine-tuning", included: true },
      { text: "Dedicated GPU infrastructure", included: true },
      { text: "Fleet management at scale (1000+ devices)", included: true },
      { text: "On-premise / air-gapped deployment", included: true },
      { text: "OTA updates & maintenance scheduling", included: true },
      { text: "SSO / SAML integration", included: true },
      { text: "Priority support & onboarding", included: true },
      { text: "Custom SLAs & contracts", included: true },
    ],
  },
];

export const competitorNames = [
  "AWS Panorama",
  "Google Vision AI",
  "Azure CV",
  "Viam",
] as const;

export const competitorFeatures: CompetitorFeature[] = [
  {
    label: "Open source",
    openeye: true,
    competitors: {
      "AWS Panorama": false,
      "Google Vision AI": false,
      "Azure CV": false,
      "Viam": true,
    },
  },
  {
    label: "Self-hosted / on-prem",
    openeye: true,
    competitors: {
      "AWS Panorama": "Partial",
      "Google Vision AI": false,
      "Azure CV": "Partial",
      "Viam": true,
    },
  },
  {
    label: "Real-time detection (30+ FPS)",
    openeye: true,
    competitors: {
      "AWS Panorama": true,
      "Google Vision AI": false,
      "Azure CV": false,
      "Viam": true,
    },
  },
  {
    label: "VLM reasoning layer",
    openeye: true,
    competitors: {
      "AWS Panorama": false,
      "Google Vision AI": "Partial",
      "Azure CV": "Partial",
      "Viam": false,
    },
  },
  {
    label: "Scene graph generation",
    openeye: true,
    competitors: {
      "AWS Panorama": false,
      "Google Vision AI": false,
      "Azure CV": false,
      "Viam": false,
    },
  },
  {
    label: "Agentic perception loop",
    openeye: true,
    competitors: {
      "AWS Panorama": false,
      "Google Vision AI": false,
      "Azure CV": false,
      "Viam": false,
    },
  },
  {
    label: "Fleet management",
    openeye: true,
    competitors: {
      "AWS Panorama": true,
      "Google Vision AI": false,
      "Azure CV": "Partial",
      "Viam": true,
    },
  },
  {
    label: "MLOps pipeline (A/B, shadow deploy)",
    openeye: true,
    competitors: {
      "AWS Panorama": "Partial",
      "Google Vision AI": true,
      "Azure CV": true,
      "Viam": false,
    },
  },
  {
    label: "Robot integration (SDK / ROS)",
    openeye: true,
    competitors: {
      "AWS Panorama": false,
      "Google Vision AI": false,
      "Azure CV": false,
      "Viam": true,
    },
  },
  {
    label: "Safety governance & audit",
    openeye: true,
    competitors: {
      "AWS Panorama": false,
      "Google Vision AI": false,
      "Azure CV": false,
      "Viam": false,
    },
  },
  {
    label: "Custom model adapters",
    openeye: true,
    competitors: {
      "AWS Panorama": true,
      "Google Vision AI": true,
      "Azure CV": true,
      "Viam": "Partial",
    },
  },
  {
    label: "No vendor lock-in",
    openeye: true,
    competitors: {
      "AWS Panorama": false,
      "Google Vision AI": false,
      "Azure CV": false,
      "Viam": "Partial",
    },
  },
  {
    label: "Pricing",
    openeye: "$0 self-hosted",
    competitors: {
      "AWS Panorama": "$$$",
      "Google Vision AI": "Pay-per-call",
      "Azure CV": "Pay-per-call",
      "Viam": "Free + paid",
    },
  },
];

export const pricingFaq: FaqItem[] = [
  {
    question: "Is OpenEye really free to use?",
    answer:
      "Yes. The CLI, all model adapters, the dashboard, MLOps pipeline, fleet management, and the local API server are open source under the Apache 2.0 license. You can self-host everything on your own hardware at no cost.",
  },
  {
    question: "When will the hosted Cloud tier be available?",
    answer:
      "The hosted API is currently in development. Join the waitlist to be notified when it launches. In the meantime, you can self-host OpenEye with full functionality.",
  },
  {
    question: "What models are supported?",
    answer:
      "OpenEye ships with 8 integrated model adapters: YOLOv8, YOLO26, RF-DETR, Grounding DINO, Depth Anything V2, SAM 2, SmolVLA, and Qwen2.5-VL (via Nebius Token Factory). ONNX and TensorRT runtimes are also included. You can add custom models through the adapter system.",
  },
  {
    question: "Do you offer GPU support for self-hosted deployments?",
    answer:
      "Yes. The CLI automatically detects CUDA (Linux) and MPS (Apple Silicon) and uses GPU acceleration when available. CPU inference is supported on all platforms as a fallback.",
  },
  {
    question: "How does the dual-layer perception work?",
    answer:
      "Every frame passes through a fast YOLO detection layer (30+ FPS) for real-time geometry. A slower VLM reasoning layer runs in parallel to catch semantic hazards that geometry alone misses, like context-dependent risks. Both layers feed into a unified scene graph.",
  },
  {
    question: "What kind of support is available?",
    answer:
      "Open Source users get community support via GitHub issues and discussions. Cloud users receive email support. Enterprise customers get priority support, dedicated onboarding, and custom SLAs.",
  },
];
