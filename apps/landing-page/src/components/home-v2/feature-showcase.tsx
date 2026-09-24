"use client";

import { useEffect, useRef, useState } from "react";

import { useInView, useReducedMotion } from "framer-motion";

import { PAGE_CONTAINER } from "@/components/home-v2/ui/layout";
import { ScrollReveal } from "@/components/home-v2/ui/scroll-reveal";
import { cn } from "@/lib/utils";
import { CollaborateSlide } from "./feature-showcase/collaborate-slide";
import { DraftSlide } from "./feature-showcase/draft-slide";
import { PlanSlide } from "./feature-showcase/plan-slide";
import { ResearchSlide } from "./feature-showcase/research-slide";
import { ShowcaseTabs } from "./feature-showcase/showcase-tabs";
import type { SlideType, Tab } from "./feature-showcase/types";

const TABS: Tab[] = [
  {
    label: "Research projects with AI",
    description:
      "Automatically surface relevant project context. Our AI reads your uploads, finds the right Categorical Exclusions, and references past online documents.",
    type: "research",
  },
  {
    label: "Draft NEPA documents",
    description:
      "Turn a blank page into a structured NEPA document in seconds. We auto-generate scoping letters and decision memos with correct locations, intents, and citations.",
    type: "draft",
  },
  {
    label: "Plan projects with AI",
    description:
      "Track every detail — from botany surveys to GIS boundaries — on an interactive Gantt of milestones and tasks.",
    type: "plan",
  },
  {
    label: "Collaborate with partners",
    description:
      "A secure workspace for members, comments, and a full activity timeline. External partners submit and review work directly with your agency.",
    type: "collab",
  },
];

// Matches the `showcase-tab-shrink` duration in showcase-tabs.tsx.
const TAB_SHRINK_DURATION_MS = 250;

interface FeatureShowcaseProps {
  // Entrance delay, so the card can join a surrounding reveal sequence.
  revealDelay?: number;
}

export function FeatureShowcase({ revealDelay = 0 }: FeatureShowcaseProps) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(sectionRef, { amount: 0.4 });
  const prefersReducedMotion = useReducedMotion();

  const [active, setActive] = useState(0);
  const [exiting, setExiting] = useState<number | null>(null);
  // Bumps on every activation so mocks (reveal rows + progress bars) remount
  // and replay their entrance animations.
  const [phase, setPhase] = useState(0);

  const autoAdvance = isInView && !prefersReducedMotion;

  const goTo = (index: number) => {
    if (index === active) {
      return;
    }
    setExiting(active);
    setActive(index);
    setPhase((p) => p + 1);
  };

  // Kick off the first slide's reveal once the section scrolls into view.
  useEffect(() => {
    if (isInView && phase === 0) {
      setPhase(1);
    }
  }, [isInView, phase]);

  // Clear the exiting tab after its shrink animation finishes.
  useEffect(() => {
    if (exiting === null) {
      return;
    }
    const timeout = window.setTimeout(
      () => setExiting(null),
      TAB_SHRINK_DURATION_MS,
    );
    return () => window.clearTimeout(timeout);
  }, [exiting]);

  const handleTabEnd = () => {
    setExiting(active);
    setActive((prev) => (prev + 1) % TABS.length);
    setPhase((p) => p + 1);
  };

  return (
    <div ref={sectionRef} className="w-full">
      <ScrollReveal
        direction="up"
        distance={24}
        delay={revealDelay}
        className="w-full"
      >
        {/* Glass shell — segmented tabs, description and the app window all
            sit in one card, with the window inset ~10px from its edge. */}
        <div className={PAGE_CONTAINER}>
          <div className="glass-card flex w-full flex-col items-center gap-4 rounded-[28px] p-2.5">
            <ShowcaseTabs
              tabs={TABS}
              active={active}
              exiting={exiting}
              phase={phase}
              prefersReducedMotion={Boolean(prefersReducedMotion)}
              autoAdvance={autoAdvance}
              onSelect={goTo}
              onTabEnd={handleTabEnd}
            />

            {/* Active-slide description. Every description sits in the same
                grid cell (like the hero H1), so the block always reserves the
                tallest one and tab switches never change the card height; the
                active one crossfades in while the others go `invisible`. */}
            <div className="grid w-full max-w-[640px] px-4">
              {TABS.map((tab, index) => (
                <p
                  key={tab.type}
                  aria-hidden={index !== active}
                  className={cn(
                    "col-start-1 row-start-1 text-center font-inter text-[15px] font-medium leading-[24px] text-egray-700 transition-[opacity,translate,visibility] duration-200 ease-out-expo motion-reduce:translate-y-0",
                    index === active
                      ? "visible translate-y-0 opacity-100"
                      : "invisible translate-y-1.5 opacity-0",
                  )}
                >
                  {tab.description}
                </p>
              ))}
            </div>

            {/* Stage — panels crossfade in place (250ms). Both panels overlap
                mid-swap, so a 2px blur masks the seam; `invisible` lands
                after the fade and takes idle panels out of rendering.
                Height is fixed per viewport (never by slide content). On
                laptops+ it follows the window height so tabs + description +
                window fit on one screen below the sticky navbar; `/ var(--ui-scale)` undoes the body
                zoom that viewport units would otherwise get twice. */}
            <div className="relative h-[540px] w-full overflow-hidden rounded-2xl md:h-[600px] lg:h-[clamp(520px,calc(100svh/var(--ui-scale)_-_250px),640px)]">
              {TABS.map((tab, index) => {
                const isActive = index === active;
                return (
                  <div
                    key={tab.type}
                    role="tabpanel"
                    id={`showcase-panel-${index}`}
                    aria-labelledby={`showcase-tab-${index}`}
                    aria-hidden={!isActive}
                    className={cn(
                      "absolute inset-0 flex items-stretch justify-center transition-[opacity,translate,filter,visibility] duration-250 ease-out-expo",
                      isActive
                        ? "visible translate-y-0 opacity-100 blur-none"
                        : "pointer-events-none invisible translate-y-2 opacity-0 blur-[2px] motion-reduce:translate-y-0 motion-reduce:blur-none",
                    )}
                  >
                    <MockScreen
                      type={tab.type}
                      playKey={isActive ? `active-${phase}` : "idle"}
                      reduce={Boolean(prefersReducedMotion)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </ScrollReveal>
    </div>
  );
}

type MockScreenProps = {
  type: SlideType;
  playKey: string;
  reduce: boolean;
};

function MockScreen({ type, playKey, reduce }: MockScreenProps) {
  return (
    // Remount on activation so entrance animations replay.
    <div key={playKey} className="h-full w-full">
      {type === "research" && <ResearchSlide reduce={reduce} />}
      {type === "draft" && <DraftSlide reduce={reduce} />}
      {type === "plan" && <PlanSlide reduce={reduce} />}
      {type === "collab" && <CollaborateSlide reduce={reduce} />}
    </div>
  );
}
