"use client";

import { BrainCircuit, ChartGantt, Handshake, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";
import { FeatureSection } from "./feature-section";
import { PAGE_GUTTER, SECTION_Y } from "./ui/layout";

const FEATURES = [
  {
    badge: "Research",
    badgeIcon: BrainCircuit,
    heading: "Find the right Categorical Exclusion",
    headingAccent: "in seconds",
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
    heading: "Turn a blank page into a",
    headingAccent: "NEPA draft",
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
    heading: "Track every survey, boundary and",
    headingAccent: "milestone",
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
    heading: "Collaborate with the community and",
    headingAccent: "partners",
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
    // Rows are spaced with the shared section rhythm.
    <section
      className={cn(
        PAGE_GUTTER,
        SECTION_Y,
        "flex flex-col items-center gap-16 self-stretch sm:gap-20 lg:gap-28",
      )}
    >
      {FEATURES.map((feature) => (
        <FeatureSection key={feature.badge} {...feature} />
      ))}
    </section>
  );
}
