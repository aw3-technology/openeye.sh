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
    highlighted: true,
    badge: "Available Now",
    features: [
      { text: "Full CLI toolchain", included: true },
      { text: "All model adapters (YOLO, Depth, DINO)", included: true },
      { text: "Apache 2.0 license", included: true },
      { text: "REST & WebSocket API server", included: true },
      { text: "Fleet management CLI", included: true },
      { text: "Community support (GitHub)", included: true },
    ],
  },
  {
    name: "Cloud",
    price: "Coming Soon",
    description:
      "Hosted inference API — no GPU management required. Currently in development.",
    cta: "Join Waitlist",
    ctaHref: "mailto:hello@openeye.sh",
    features: [
      { text: "Everything in Open Source", included: true },
      { text: "Hosted inference API", included: true },
      { text: "API key management", included: true },
      { text: "Usage dashboard & analytics", included: true },
      { text: "Email support", included: true },
      { text: "Custom model deployment", included: false },
    ],
  },
  {
    name: "Enterprise",
    price: "Contact Us",
    description:
      "Managed deployment with custom models, dedicated infrastructure, and priority support.",
    cta: "Contact Sales",
    ctaHref: "mailto:sales@openeye.sh",
    features: [
      { text: "Everything in Cloud", included: true },
      { text: "Custom model training & deployment", included: true },
      { text: "Dedicated GPU infrastructure", included: true },
      { text: "Priority support & onboarding", included: true },
      { text: "On-premise deployment option", included: true },
      { text: "Custom SLAs & contracts", included: true },
    ],
  },
];

export const pricingFaq: FaqItem[] = [
  {
    question: "Is OpenEye really free to use?",
    answer:
      "Yes. The CLI, all model adapters, and the local API server are open source under the Apache 2.0 license. You can self-host everything on your own hardware at no cost.",
  },
  {
    question: "When will the hosted Cloud tier be available?",
    answer:
      "The hosted API is currently in development. Join the waitlist to be notified when it launches. In the meantime, you can self-host OpenEye with full functionality.",
  },
  {
    question: "What models are supported?",
    answer:
      "OpenEye currently supports YOLOv8, Depth Anything V2, and Grounding DINO, with more models on the roadmap. You can also add custom models via the adapter system.",
  },
  {
    question: "Do you offer GPU support for self-hosted deployments?",
    answer:
      "Yes. The CLI automatically detects CUDA (Linux) and MPS (Apple Silicon) and uses GPU acceleration when available. CPU inference is supported on all platforms as a fallback.",
  },
  {
    question: "What kind of support is available?",
    answer:
      "Open Source users get community support via GitHub issues and discussions. Enterprise customers can contact us for dedicated support options.",
  },
];
