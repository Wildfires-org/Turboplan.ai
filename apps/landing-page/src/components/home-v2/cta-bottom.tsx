"use client";

import { useEffect, useState } from "react";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";

import CatalogRequestDialog from "@/components/dialogs/catalog-request-dialog/catalog-request-dialog";
import {
  PAGE_CONTAINER,
  PAGE_GUTTER,
  PANEL_STACK_Y,
} from "@/components/home-v2/ui/layout";
import { ScrollReveal } from "@/components/home-v2/ui/scroll-reveal";
import {
  HEADER_STACK_CLASS,
  SECTION_LEAD_CLASS,
  SECTION_TITLE_CLASS,
} from "@/components/home-v2/ui/section-header";
import { useTypewriterHeading } from "@/components/home-v2/ui/typewriter-heading";
import { useAnalytics } from "@/hooks/useAnalytics";
import { cn } from "@/lib/utils";
import { events } from "@/types/analytics";
import { routing } from "@/utils/routing";
import { Footer } from "./footer";

const CTA_WORDS = [
  "environmental planning ?",
  "road repairs ?",
  "forestry ?",
  "forest treatments ?",
  "nuclear power plants ?",
];

const CURSOR_BLINK_RATE = 530;

// Same entrance rhythm as ScrollReveal elsewhere: panel, then the buttons
// 60ms later, then the footer another 60ms on.
const BUTTONS_DELAY = 0.06;
const FOOTER_DELAY = 0.12;

const SPARKLE_TRANSITION = {
  type: "spring",
  duration: 0.5,
  bounce: 0.2,
} as const;

export function CtaBottom() {
  const router = useRouter();
  const { captureEvent } = useAnalytics();
  const { displayText, currentIndex } = useTypewriterHeading(CTA_WORDS);
  const prefersReducedMotion = useReducedMotion();

  // Blinking cursor — static (always visible) under reduced motion.
  const [showCursor, setShowCursor] = useState(true);
  useEffect(() => {
    if (prefersReducedMotion) {
      setShowCursor(true);
      return;
    }
    const interval = setInterval(
      () => setShowCursor((prev) => !prev),
      CURSOR_BLINK_RATE,
    );
    return () => clearInterval(interval);
  }, [prefersReducedMotion]);

  // Track index changes for sparkle animation
  const [sparkleKey, setSparkleKey] = useState(0);
  useEffect(() => {
    setSparkleKey((key) => key + 1);
  }, [currentIndex]);

  const handleCreateProject = () => {
    captureEvent(events.TRY_IT_CLICKED);
    router.push(routing.home({ tryIt: "true" }));
  };

  const handleAddToCatalog = () => {
    captureEvent(events.CATALOG_REQUEST_CLICKED);
  };

  return (
    <section id="cta-footer" className="w-full font-inter">
      {/* Follows the Contact panel, so it uses the tighter panel step. It is
          the last section, so it also owns the (tighter) gap to the footer. */}
      <div
        className={cn(PAGE_GUTTER, PANEL_STACK_Y, "pb-10 sm:pb-12 lg:pb-16")}
      >
        <ScrollReveal direction="up" className={PAGE_CONTAINER}>
          <div className="glass-card rounded-[28px] p-6 text-center sm:p-12 lg:p-16">
            <div className="flex flex-col items-center">
              <div
                className={cn(HEADER_STACK_CLASS, "max-w-[760px] items-center")}
              >
                <h2 className={SECTION_TITLE_CLASS}>
                  {/* Stable accessible name — the typewriter below mutates
                    every few ms and would spam screen readers. */}
                  <span className="sr-only">
                    Ready to accelerate your environmental planning?
                  </span>
                  <span aria-hidden="true" className="block">
                    Ready to accelerate your
                  </span>
                  {/* Every word is laid out invisibly in the same grid cell as
                      the live text, so the cell is always as tall as the
                      longest wrap and the panel never jumps while typing. */}
                  <span aria-hidden="true" className="grid">
                    {CTA_WORDS.map((word) => (
                      <span
                        key={word}
                        className="invisible col-start-1 row-start-1"
                      >
                        <TypedLine text={word} />
                      </span>
                    ))}
                    <span className="col-start-1 row-start-1">
                      <TypedLine
                        text={displayText}
                        sparkleKey={sparkleKey}
                        isCursorVisible={showCursor}
                        prefersReducedMotion={Boolean(prefersReducedMotion)}
                      />
                    </span>
                  </span>
                </h2>

                <p className={cn(SECTION_LEAD_CLASS, "max-w-[520px]")}>
                  Start a project in minutes — draft, plan and track NEPA work
                  in one workspace.
                </p>
              </div>

              <ScrollReveal
                direction="up"
                delay={BUTTONS_DELAY}
                className="mt-8 flex w-full max-w-[420px] flex-col items-center gap-3 sm:mt-10 sm:w-auto sm:max-w-none sm:flex-row sm:gap-4"
              >
                {/* Secondary — Add to Catalog (opens catalog request dialog) */}
                <CatalogRequestDialog>
                  <button
                    type="button"
                    onClick={handleAddToCatalog}
                    className="glass press inline-flex h-12 w-full items-center justify-center rounded-xl px-6 text-body-md font-medium text-brand-800 hover:bg-white/80 sm:w-auto sm:min-w-[200px]"
                  >
                    Add to Catalog
                  </button>
                </CatalogRequestDialog>

                {/* Primary — Create Project (try-it flow) */}
                <button
                  type="button"
                  onClick={handleCreateProject}
                  className="btn-primary press inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl px-6 text-body-md font-medium sm:w-auto sm:min-w-[200px]"
                >
                  Create Project
                  <ArrowUpRight className="size-4" />
                </button>
              </ScrollReveal>
            </div>
          </div>
        </ScrollReveal>
      </div>

      <div id="footer-nav">
        <ScrollReveal direction="up" delay={FOOTER_DELAY}>
          <Footer />
        </ScrollReveal>
      </div>
    </section>
  );
}

interface TypedLineProps {
  text: string;
  sparkleKey?: number;
  isCursorVisible?: boolean;
  prefersReducedMotion?: boolean;
}

// Sparkle + accent word + cursor. The invisible sizing copies render it
// static (no sparkleKey), so only the live line animates.
const TypedLine = ({
  text,
  sparkleKey,
  isCursorVisible = true,
  prefersReducedMotion = false,
}: TypedLineProps) => {
  const isLive = sparkleKey !== undefined;

  return (
    <>
      {/* Off under reduced motion; same spring as the hero. */}
      <motion.span
        key={sparkleKey}
        initial={
          !isLive || prefersReducedMotion
            ? false
            : { transform: "scale(1.3) rotate(25deg)" }
        }
        animate={{ transform: "scale(1) rotate(0deg)" }}
        transition={SPARKLE_TRANSITION}
        className="mr-2 inline-flex align-middle text-brand-700 lg:mr-3"
      >
        <Sparkles className="size-[0.75em]" />
      </motion.span>
      <span className="text-brand-700">
        {text}
        <span
          className={cn(
            "ml-[1px] inline-block h-[0.75em] w-[3px] bg-brand-700 transition-opacity duration-100",
            isCursorVisible ? "opacity-100" : "opacity-0",
          )}
        />
      </span>
    </>
  );
};
