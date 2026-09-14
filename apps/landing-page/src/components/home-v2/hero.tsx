"use client";

import { useEffect, useState } from "react";

import { AnimatePresence, motion } from "framer-motion";
import {
  Flame,
  type LucideIcon,
  Route,
  Sparkles,
  TreePine,
  Zap,
} from "lucide-react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";

import { PROJECT_DESCRIPTION_PARAM } from "@/consts/urlParams";
import { routing } from "@/utils/routing";
import { QuickStartPills } from "./ui/quick-start-pills";
import { ScrollReveal } from "./ui/scroll-reveal";
import { SearchInput } from "./ui/search-input";
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

const LOGOS = [
  { name: "Wildfires", src: "/images/logos/wildfires.svg" },
  { name: "USFS", src: "/images/logos/usfs.svg" },
  { name: "Partner 3", src: "/images/logos/partner-3.svg" },
  { name: "Partner 4", src: "/images/logos/partner-4.svg" },
  { name: "Partner 5", src: "/images/logos/partner-5.svg" },
  { name: "Partner 6", src: "/images/logos/partner-6.svg" },
  { name: "Partner 7", src: "/images/logos/partner-7.svg" },
];

const CURSOR_BLINK_RATE = 530;

const getPromptTextarea = () =>
  document.getElementById("project-prompt-input")?.querySelector("textarea");

export function Hero() {
  const router = useRouter();
  const params = useSearchParams();

  const headingWords = CONTENT_PAIRS.map((p) => p.heading);
  const { displayText, currentIndex } = useTypewriterHeading(headingWords);

  const [promptValue, setPromptValue] = useState(
    params.get(PROJECT_DESCRIPTION_PARAM) || "",
  );

  // Blinking cursor
  const [showCursor, setShowCursor] = useState(true);
  useEffect(() => {
    const interval = setInterval(
      () => setShowCursor((p) => !p),
      CURSOR_BLINK_RATE,
    );
    return () => clearInterval(interval);
  }, []);

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
    <section className="bg-brandAlt-100">
      {/* Outer wrapper */}
      <div className="flex flex-col items-center">
        {/* Top content block */}
        <div className="flex w-full max-w-[1280px] flex-col items-center px-6 pb-12 pt-12 text-center sm:pb-16 sm:pt-16 lg:px-28 lg:pb-[88px] lg:pt-[88px]">
          <ScrollReveal delay={0} direction="up" distance={30}>
            <div className="flex flex-col items-center gap-[18px]">
              {/* Eyebrow — synced with heading index */}
              <div className="flex h-[28px] items-center justify-center">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={CONTENT_PAIRS[currentIndex].eyebrow}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 font-heading text-[12px] font-medium uppercase leading-[16px] tracking-[0.96px] text-brand-600"
                  >
                    <EyebrowIcon className="size-3.5" />
                    {CONTENT_PAIRS[currentIndex].eyebrow}
                  </motion.span>
                </AnimatePresence>
              </div>

              {/* H1 — two lines */}
              <h1 className="min-h-[100px] font-heading text-[36px] font-normal leading-[1.15] tracking-[-2px] text-[#1A1A1A] md:min-h-[120px] md:text-[48px] md:tracking-[-2.8px] lg:min-h-[140px] lg:text-[60px] lg:tracking-[-3.6px]">
                {/* Stable accessible name — the typewriter below mutates every
                    few ms and would spam screen readers. */}
                <span className="sr-only">
                  Accelerate your environmental planning
                </span>
                <span aria-hidden="true" className="block">
                  Accelerate your
                </span>
                <span aria-hidden="true" className="inline">
                  <motion.span
                    key={sparkleKey}
                    initial={{ scale: 1.3, rotate: 25 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{
                      type: "spring",
                      stiffness: 400,
                      damping: 15,
                      duration: 0.5,
                    }}
                    className="mr-2 inline-flex align-middle text-brand-600 lg:mr-3"
                  >
                    <Sparkles className="size-[28px] md:size-[35px] lg:size-[42px]" />
                  </motion.span>
                  <span className="text-brand-600">
                    {displayText}
                    <span
                      className={`ml-[1px] inline-block w-[3px] bg-brand-600 transition-opacity duration-100 ${
                        showCursor ? "opacity-100" : "opacity-0"
                      }`}
                      style={{ height: "0.75em" }}
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

          {/* Pills → Logos — staggered fade-in per logo */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-6 sm:mt-16 sm:gap-8 md:gap-10 lg:mt-[84px] lg:gap-12">
            {LOGOS.map((logo, i) => (
              <ScrollReveal
                key={logo.name}
                delay={0.35 + i * 0.07}
                direction="up"
                distance={12}
              >
                <div className="transition-opacity duration-300 hover:opacity-80">
                  <Image
                    src={logo.src}
                    alt={logo.name}
                    width={120}
                    height={32}
                    className="h-6 w-auto object-contain sm:h-7 lg:h-8"
                  />
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
