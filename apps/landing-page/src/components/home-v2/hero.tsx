"use client";

import { useEffect, useState } from "react";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Flame,
  type LucideIcon,
  Route,
  Sparkles,
  TreePine,
  Zap,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import { PROJECT_DESCRIPTION_PARAM } from "@/consts/urlParams";
import { cn } from "@/lib/utils";
import { routing } from "@/utils/routing";
import { FeatureShowcase } from "./feature-showcase";
import { PAGE_CONTAINER, PAGE_GUTTER } from "./ui/layout";
import { EASE_OUT } from "./ui/motion";
import { QuickStartPills } from "./ui/quick-start-pills";
import { ScrollReveal } from "./ui/scroll-reveal";
import { SearchInput } from "./ui/search-input";
import { EYEBROW_CLASS, EYEBROW_ICON_CLASS } from "./ui/section-header";
import { useTypewriterHeading } from "./ui/typewriter-heading";

interface ContentPair {
  eyebrow: string;
  heading: string;
  Icon: LucideIcon;
}

const CONTENT_PAIRS: ContentPair[] = [
  {
    eyebrow: "THE AI-NATIVE NEPA WORKSPACE",
    heading: "environmental planning",
    Icon: Sparkles,
  },
  {
    eyebrow: "PUBLIC LANDS INFRASTRUCTURE",
    heading: "road repairs",
    Icon: Route,
  },
  { eyebrow: "MODERN FOREST MANAGEMENT", heading: "forestry", Icon: TreePine },
  {
    eyebrow: "AI ENVIRONMENTAL PLANNING",
    heading: "environmental planning",
    Icon: Flame,
  },
  {
    eyebrow: "CRITICAL ENERGY PROJECTS",
    heading: "nuclear power plants",
    Icon: Zap,
  },
];

const CURSOR_BLINK_RATE = 530;

// Showcase enters just after the pills (0.25s) in the hero sequence.
const SHOWCASE_REVEAL_DELAY = 0.35;

const SPARKLE_TRANSITION = {
  type: "spring",
  duration: 0.5,
  bounce: 0.2,
} as const;

const getPromptTextarea = () =>
  document.getElementById("project-prompt-input")?.querySelector("textarea");

export function Hero() {
  const router = useRouter();
  const params = useSearchParams();

  const headingWords = CONTENT_PAIRS.map((p) => p.heading);
  // Sizing copies only need each distinct word once (keys must be unique).
  const uniqueHeadingWords = [...new Set(headingWords)];
  const { displayText, currentIndex } = useTypewriterHeading(headingWords);
  const prefersReducedMotion = useReducedMotion();

  const [promptValue, setPromptValue] = useState(
    params.get(PROJECT_DESCRIPTION_PARAM) || "",
  );

  // Blinking cursor — static (always visible) under reduced motion.
  const [showCursor, setShowCursor] = useState(true);
  useEffect(() => {
    if (prefersReducedMotion) {
      setShowCursor(true);
      return;
    }
    const interval = setInterval(
      () => setShowCursor((p) => !p),
      CURSOR_BLINK_RATE,
    );
    return () => clearInterval(interval);
  }, [prefersReducedMotion]);

  // Track index changes for sparkle animation
  const [sparkleKey, setSparkleKey] = useState(0);
  useEffect(() => {
    setSparkleKey((k) => k + 1);
  }, [currentIndex]);

  // Preserve ?tryIt=true behavior: scroll to and focus the prompt input on
  // mount, then strip the param from the URL.
  useEffect(() => {
    if (!params.get("tryIt")) {
      return;
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
    getPromptTextarea()?.focus({ preventScroll: true });

    // Strip the param only after the smooth scroll has finished — an
    // immediate replace cancels the scroll animation.
    const timeout = setTimeout(() => {
      router.replace(routing.home(), { scroll: false });
    }, 600);
    return () => clearTimeout(timeout);
  }, [params, router]);

  // Focus the prompt with the caret at the end so Enter submits right away.
  // Selection is set on the next frame, after React has flushed the new value.
  const handleQuickStart = (prompt: string) => {
    setPromptValue(prompt);

    const textarea = getPromptTextarea();
    if (!textarea) {
      return;
    }

    textarea.focus({ preventScroll: true });
    requestAnimationFrame(() => {
      textarea.setSelectionRange(prompt.length, prompt.length);
    });
  };

  const EyebrowIcon = CONTENT_PAIRS[currentIndex].Icon;

  return (
    <section className={PAGE_GUTTER}>
      {/* Bottom padding is shorter than SECTION_Y: the logo marquee's own
          padding and hairline complete the gap. */}
      <div className="flex flex-col items-center">
        <div
          className={cn(
            PAGE_CONTAINER,
            "flex flex-col items-center pb-10 pt-12 text-center sm:pb-12 sm:pt-16 lg:pb-16 lg:pt-[88px]",
          )}
        >
          <ScrollReveal delay={0} direction="up" distance={30}>
            <div className="flex flex-col items-center gap-[18px]">
              {/* Eyebrow — synced with heading index */}
              <div className="flex h-[28px] items-center justify-center">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={CONTENT_PAIRS[currentIndex].eyebrow}
                    initial={
                      prefersReducedMotion
                        ? { opacity: 0 }
                        : { opacity: 0, transform: "translateY(6px)" }
                    }
                    animate={{ opacity: 1, transform: "translateY(0px)" }}
                    exit={
                      prefersReducedMotion
                        ? { opacity: 0 }
                        : { opacity: 0, transform: "translateY(-6px)" }
                    }
                    transition={{ duration: 0.2, ease: EASE_OUT }}
                    className={EYEBROW_CLASS}
                  >
                    <EyebrowIcon className={EYEBROW_ICON_CLASS} />
                    {CONTENT_PAIRS[currentIndex].eyebrow}
                  </motion.span>
                </AnimatePresence>
              </div>

              {/* H1 — no fixed min-height: every heading word is laid out
                  invisibly in the same grid cell as the live text, so the
                  block always reserves the longest wrap at any width. */}
              <h1 className="font-heading text-[36px] font-normal leading-[1.15] tracking-[-2px] text-[#1A1A1A] md:text-[48px] md:tracking-[-2.8px] lg:text-[60px] lg:tracking-[-3.6px]">
                {/* Stable accessible name — the typewriter below mutates every
                    few ms and would spam screen readers. */}
                <span className="sr-only">
                  Accelerate your environmental planning
                </span>
                <span aria-hidden="true" className="block">
                  Accelerate your
                </span>
                <span aria-hidden="true" className="grid">
                  {uniqueHeadingWords.map((word) => (
                    <span
                      key={word}
                      className="invisible col-start-1 row-start-1"
                    >
                      <HeadingLine text={word} />
                    </span>
                  ))}
                  <span className="col-start-1 row-start-1">
                    <HeadingLine
                      text={displayText}
                      sparkleKey={sparkleKey}
                      isCursorVisible={showCursor}
                      prefersReducedMotion={Boolean(prefersReducedMotion)}
                    />
                  </span>
                </span>
              </h1>
            </div>
          </ScrollReveal>

          {/* H1 → Input */}
          <ScrollReveal
            delay={0.15}
            direction="up"
            distance={20}
            className="mt-[42px] w-full max-w-[686px]"
          >
            <SearchInput value={promptValue} onValueChange={setPromptValue} />
          </ScrollReveal>

          {/* Input → Pills — Embla carousel with ambient auto-scroll. Hover,
              focus, drag/swipe and the arrows all pause it, so a missed
              example is one gesture away instead of a full loop away. */}
          <ScrollReveal
            delay={0.25}
            direction="up"
            distance={16}
            className="mt-[18px] w-full max-w-[686px]"
          >
            <QuickStartPills onSelect={handleQuickStart} />
          </ScrollReveal>

          {/* Pills → Product showcase. Joins the hero's entrance sequence
              right after the pills; `text-left` resets the hero's centered
              text for the app mockups inside. */}
          <div className="mt-10 w-full text-left sm:mt-12 lg:mt-16">
            <FeatureShowcase revealDelay={SHOWCASE_REVEAL_DELAY} />
          </div>
        </div>
      </div>
    </section>
  );
}

interface HeadingLineProps {
  text: string;
  sparkleKey?: number;
  isCursorVisible?: boolean;
  prefersReducedMotion?: boolean;
}

// Sparkle + accent word + cursor. The invisible sizing copies render it
// static (no sparkleKey), so only the live line animates.
const HeadingLine = ({
  text,
  sparkleKey,
  isCursorVisible = true,
  prefersReducedMotion = false,
}: HeadingLineProps) => {
  const isLive = sparkleKey !== undefined;

  return (
    <>
      {/* Sparkle settles in on each word change — occasional marketing
          motion, so a gentle spring; off under reduced motion. */}
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
        <Sparkles className="size-[28px] md:size-[35px] lg:size-[42px]" />
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
