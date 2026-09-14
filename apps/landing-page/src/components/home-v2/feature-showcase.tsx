"use client";

import { useEffect, useRef, useState } from "react";

import {
  AnimatePresence,
  motion,
  useInView,
  useReducedMotion,
} from "framer-motion";

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

export function FeatureShowcase() {
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
    const timeout = window.setTimeout(() => setExiting(null), 500);
    return () => window.clearTimeout(timeout);
  }, [exiting]);

  const handleTabEnd = () => {
    setExiting(active);
    setActive((prev) => (prev + 1) % TABS.length);
    setPhase((p) => p + 1);
  };

  return (
    <div ref={sectionRef} className="w-full">
      <ScrollReveal direction="up" distance={24} className="w-full">
        <div className="mx-auto flex w-full max-w-[1040px] flex-col items-center gap-8 px-6 lg:px-8">
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

          {/* Active-slide description — swaps with a soft crossfade. */}
          <div className="flex min-h-[48px] max-w-[640px] items-start justify-center">
            <AnimatePresence mode="wait">
              <motion.p
                key={active}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="text-center font-inter text-[15px] font-medium leading-[24px] text-egray-600"
              >
                {TABS[active].description}
              </motion.p>
            </AnimatePresence>
          </div>

          {/* Stage */}
          <div
            className="relative h-[560px] w-full overflow-hidden rounded-[20px] border border-egray-100 md:h-[640px] lg:h-[700px]"
            style={{
              background:
                "linear-gradient(180deg, #f4f9f7 0%, #eaf1ee 55%, #e2ece7 100%)",
            }}
          >
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
                    "absolute inset-0 flex items-stretch justify-center p-3 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] sm:p-4 md:p-6",
                    isActive
                      ? "translate-y-0 opacity-100"
                      : "pointer-events-none translate-y-3 opacity-0",
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
