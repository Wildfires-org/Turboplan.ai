"use client";

import { BrainCircuit, ChartGantt, Handshake, Sparkles } from "lucide-react";

import { FeatureSection } from "./feature-section";
import { FeatureShowcase } from "./feature-showcase";

const FEATURES = [
  {
    badge: "Research",
    badgeIcon: BrainCircuit,
    heading: "Accelerate project research",
    description:
      "Automatically surface relevant project context. Our AI instantly finds the right Categorical Exclusions and references past online documents.",
    visualSrc: "/images/features/research.webp",
    visualAlt: "Smart content research interface",
    beaverSrc: "/images/beavers/beaver_smartcontext.png",
    beaverAlt: "Beaver mascot for research",
    beaverFlip: true,
    direction: "left" as const,
  },
  {
    badge: "AI Drafting",
    badgeIcon: Sparkles,
    heading: "Accelerate drafting NEPA documents",
    description:
      "Turn a blank page into a structured NEPA document in seconds. We auto-generate Scoping Letters with correct locations, intents, and citations.",
    visualSrc: "/images/features/aidrafting.webp",
    visualAlt: "AI drafting interface",
    beaverSrc: "/images/beavers/beaver_aidrafting.png",
    beaverAlt: "Beaver mascot for documents",
    direction: "right" as const,
  },
  {
    badge: "Planning",
    badgeIcon: ChartGantt,
    heading: "Accelerate project planning",
    description:
      "Track every detail — from Botany Surveys to GIS boundaries. On an interactive, keyboard-friendly Gantt chart.",
    visualSrc: "/images/features/planning.webp",
    visualAlt: "Project planning interface",
    beaverSrc: "/images/beavers/beaver_precisiontracking.png",
    beaverAlt: "Beaver mascot for planning",
    direction: "left" as const,
  },
  {
    badge: "Community",
    badgeIcon: Handshake,
    heading: "Collaborate with the community and partners",
    description:
      "Provide a secure platform for public comments. External partners can easily submit project applications directly to your agency.",
    visualSrc: "/images/features/community.webp",
    visualAlt: "Collaboration interface",
    beaverSrc: "/images/beavers/beaver_seamless_handoffs.png",
    beaverAlt: "Beaver mascot for collaboration",
    direction: "right" as const,
  },
];

export function Features() {
  return (
    <section
      className="flex flex-col items-center gap-16 self-stretch pt-8 pb-12 sm:gap-20 sm:pt-10 sm:pb-16 md:gap-24 lg:gap-[132px] lg:pt-12 lg:pb-[90px]"
      style={{
        background:
          "linear-gradient(180deg, rgba(209, 230, 222, 0.00) -41.46%, #F4F9F7 64.05%)",
      }}
    >
      <FeatureShowcase />
      {FEATURES.map((feature) => (
        <FeatureSection key={feature.badge} {...feature} />
      ))}
    </section>
  );
}
