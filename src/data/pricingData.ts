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

export const pricingTiers: PricingPlanTier[] = [
  {
    name: "Open Source",
    price: "Free forever",
    description:
      "Self-hosted CLI with full perception capabilities. Run on your own hardware, no strings attached.",
    cta: "Get Started",
    ctaHref: "/docs#installation",
    features: [
      { text: "Full CLI toolchain", included: true },
      { text: "All model adapters (YOLO, Depth, DINO)", included: true },
      { text: "Apache 2.0 license", included: true },
      { text: "REST & WebSocket API server", included: true },
      { text: "Community support (GitHub)", included: true },
      { text: "Hosted inference", included: false },
      { text: "Usage dashboard", included: false },
      { text: "SLA guarantee", included: false },
    ],
  },
  {
    name: "Cloud",
    price: "Usage-based",
    description:
      "Credit-based hosted inference — 1,000 free credits on signup. No GPU management, just API keys and go.",
    cta: "Start Free Trial",
    ctaHref: "/login",
    highlighted: true,
    badge: "Most Popular",
    features: [
      { text: "Everything in Open Source", included: true },
      { text: "Hosted inference (1,000 free credits)", included: true },
      { text: "API key management", included: true },
      { text: "Usage dashboard & analytics", included: true },
      { text: "99.5% uptime SLA", included: true },
      { text: "Email support", included: true },
      { text: "Custom model deployment", included: false },
      { text: "Dedicated infrastructure", included: false },
    ],
  },
  {
    name: "Enterprise",
    price: "Custom",
    description:
      "Managed deployment with custom models, dedicated infrastructure, and priority support.",
    cta: "Contact Sales",
    ctaHref: "mailto:sales@openeye.sh",
    features: [
      { text: "Everything in Cloud", included: true },
      { text: "Custom model training & deployment", included: true },
      { text: "Dedicated GPU infrastructure", included: true },
      { text: "99.99% uptime SLA", included: true },
      { text: "Priority support & onboarding", included: true },
      { text: "SSO & audit logs", included: true },
      { text: "On-premise deployment option", included: true },
      { text: "Custom SLAs & contracts", included: true },
    ],
  },
];

export const pricingFaq: FaqItem[] = [
  {
    question: "Is OpenEye really free to use?",
    answer:
      "Yes. The CLI, all model adapters, and the local API server are open source under the Apache 2.0 license. You can self-host everything on your own hardware at no cost. The Cloud and Enterprise tiers are optional services for teams that want hosted inference and managed infrastructure.",
  },
  {
    question: "How does usage-based pricing work on the Cloud tier?",
    answer:
      "You pay with credits — object detection costs 1 credit, depth estimation costs 2 credits, and scene description costs 3 credits. Every account gets 1,000 free credits on signup so you can test before committing. Additional credits can be purchased from the Dashboard.",
  },
  {
    question: "Can I switch between self-hosted and cloud?",
    answer:
      "Absolutely. The same CLI and API schema work in both modes. Point your application at localhost for self-hosted or at your cloud endpoint for hosted inference. No code changes required.",
  },
  {
    question: "What models are supported?",
    answer:
      "OpenEye supports YOLOv8, Depth Anything V2, Grounding DINO, and any custom model via the adapter system. On the Cloud tier, we also offer optimized variants including ONNX and TensorRT builds for faster inference.",
  },
  {
    question: "Do you offer GPU support for self-hosted deployments?",
    answer:
      "Yes. The CLI automatically detects CUDA (Linux) and MPS (Apple Silicon) and uses GPU acceleration when available. CPU inference is supported on all platforms as a fallback.",
  },
  {
    question: "What kind of support is available?",
    answer:
      "Open Source users get community support via GitHub issues and discussions. Cloud users get email support with 24-hour response times. Enterprise customers get priority support with dedicated Slack channels and onboarding assistance.",
  },
];
