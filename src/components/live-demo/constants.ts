import { Shield, Eye, Brain, Terminal } from "lucide-react";
import type { DemoTab } from "./types";

export const tabs: DemoTab[] = [
  { id: "safety", label: "Safety Guardian", icon: Shield, description: "Watch the safety monitoring system detect human intrusion and halt robot operations." },
  { id: "detect", label: "Object Detection", icon: Eye, description: "Upload an image or use our samples to see real-time object detection in action." },
  { id: "vlm", label: "VLM Reasoning", icon: Brain, description: "See how the vision-language model analyzes scenes with deep contextual understanding." },
  { id: "terminal", label: "Interactive CLI", icon: Terminal, description: "Try OpenEye CLI commands and see the output in a live terminal simulation." },
];

export const safetyColorClasses = {
  "terminal-red": {
    border: "border-terminal-red",
    bg: "bg-terminal-red/5",
    label: "bg-terminal-red",
  },
  "terminal-green": {
    border: "border-terminal-green",
    bg: "bg-terminal-green/5",
    label: "bg-terminal-green",
  },
} as const;

export const detectionColorClasses = {
  green: {
    border: "border-oe-green",
    border2: "border-oe-green",
    bg: "bg-oe-green/10",
    text: "text-oe-green",
    label: "bg-oe-green",
    resultBg: "bg-oe-green/5",
    resultBorder: "border-oe-green/20",
  },
  amber: {
    border: "border-primary",
    border2: "border-primary",
    bg: "bg-primary/10",
    text: "text-primary",
    label: "bg-primary",
    resultBg: "bg-primary/5",
    resultBorder: "border-primary/20",
  },
  red: {
    border: "border-oe-red",
    border2: "border-oe-red",
    bg: "bg-oe-red/10",
    text: "text-oe-red",
    label: "bg-oe-red",
    resultBg: "bg-oe-red/5",
    resultBorder: "border-oe-red/20",
  },
} as const;
