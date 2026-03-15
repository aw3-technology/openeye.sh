import {
  Eye,
  ShieldCheck,
  Lock,
  Lightbulb,
  Scale,
  Heart,
} from "lucide-react";

export interface TeamMember {
  name: string;
  role: string;
  bio: string;
  links: {
    github?: string;
    linkedin?: string;
  };
}

export interface Value {
  icon: React.ReactNode;
  label: string;
  detail: string;
}

export interface Milestone {
  date: string;
  event: string;
}

export const team: TeamMember[] = [
  {
    name: "William Schulz",
    role: "Founder & Lead",
    bio: "Building the perception layer for the agent era. Previously software engineering across ML infrastructure and robotics systems.",
    links: {
      github: "https://github.com/williamschulz",
      linkedin: "https://linkedin.com/in/williamschulz",
    },
  },
];

export const values: Value[] = [
  {
    icon: <Eye className="w-5 h-5 text-terminal-green" />,
    label: "Perception is infrastructure",
    detail:
      "Vision should be a shared utility — like networking or storage — not a proprietary moat. We build perception as open infrastructure for the entire robotics ecosystem.",
  },
  {
    icon: <ShieldCheck className="w-5 h-5 text-terminal-red" />,
    label: "Safety is non-negotiable",
    detail:
      "Every design decision starts with safety. Dual-layer detection, sub-100ms halt protocols, and fail-safe defaults are not features — they are the foundation.",
  },
  {
    icon: <Lock className="w-5 h-5 text-terminal-amber" />,
    label: "Open source, open trust",
    detail:
      "Safety-critical software must be inspectable. Apache 2.0 licensing means anyone can audit, modify, and deploy OpenEye. Transparency builds trust.",
  },
  {
    icon: <Lightbulb className="w-5 h-5 text-blue-400" />,
    label: "CLI-first, always",
    detail:
      "Every capability accessible from the command line. No GUI required, no vendor lock-in. Scriptable, composable, and debuggable by design.",
  },
  {
    icon: <Scale className="w-5 h-5 text-muted-foreground" />,
    label: "Model-agnostic by principle",
    detail:
      "The best model today won't be the best model tomorrow. OpenEye abstracts the vision layer so you can swap YOLO, SAM, or any VLM without changing a line of application code.",
  },
  {
    icon: <Heart className="w-5 h-5 text-terminal-green" />,
    label: "Built for builders",
    detail:
      "Designed for robotics engineers, agent developers, and researchers who need perception they can trust, understand, and extend.",
  },
];

export const milestones: Milestone[] = [
  {
    date: "Mar 2026",
    event: "OpenEye launched at Nebius.Build Hackathon SF",
  },
  {
    date: "Mar 2026",
    event: "Open-sourced under Apache 2.0",
  },
  {
    date: "Next",
    event: "ROS 2 adapter, persistent scene memory, multi-camera fusion",
  },
];
