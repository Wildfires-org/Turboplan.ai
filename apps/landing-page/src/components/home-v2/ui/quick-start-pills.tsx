"use client";

import { useCallback } from "react";

import AutoScroll from "embla-carousel-auto-scroll";
import useEmblaCarousel from "embla-carousel-react";
import { useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";

import {
  QUICK_START_EXAMPLES,
  type QuickStartExample,
} from "@/consts/quick-start-options";
import { useAnalytics } from "@/hooks/useAnalytics";
import { cn } from "@/lib/utils";
import { events } from "@/types/analytics";

type QuickStartPillsProps = {
  onSelect: (prompt: string) => void;
};

type EmblaOptions = NonNullable<Parameters<typeof useEmblaCarousel>[0]>;

const EMBLA_OPTIONS: EmblaOptions = {
  loop: true,
  align: "start",
  dragFree: true,
  skipSnaps: true,
  containScroll: false,
};

const AUTO_SCROLL_OPTIONS = {
  speed: 0.8,
  startDelay: 0,
  stopOnInteraction: false,
  stopOnMouseEnter: true,
  stopOnFocusIn: true,
  // Hover/focus pausing is scoped to the wrapper (viewport + arrows) rather
  // than the viewport alone, so moving the pointer onto an arrow button does
  // not read as "left the carousel" and restart the scroll under the cursor.
  rootNode: (emblaRoot: HTMLElement) => emblaRoot.parentElement,
};

const EDGE_FADE =
  "linear-gradient(to right, transparent, black 32px, black calc(100% - 32px), transparent)";

const SLIDES_PER_ARROW_CLICK = 3;

const ARROW_CLASSES =
  "glass press absolute top-1/2 z-10 hidden size-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-[#262626] opacity-0 hover:bg-white/80 focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100 sm:flex";

export function QuickStartPills({ onSelect }: QuickStartPillsProps) {
  const prefersReducedMotion = useReducedMotion();
  const { captureEvent } = useAnalytics();

  const [emblaRef, emblaApi] = useEmblaCarousel(
    EMBLA_OPTIONS,
    prefersReducedMotion ? [] : [AutoScroll(AUTO_SCROLL_OPTIONS)],
  );

  // Only the pill's label is sent — the prompts are predefined marketing
  // copy, so the label identifies the example without shipping prompt text.
  const handleSelect = (example: QuickStartExample) => {
    captureEvent(events.QUICK_START_SELECTED, { pill: example.label });
    onSelect(example.prompt);
  };

  const scrollBySlides = useCallback(
    (delta: number) => {
      if (!emblaApi) {
        return;
      }

      const snapCount = emblaApi.scrollSnapList().length;
      if (snapCount === 0) {
        return;
      }

      // reset() restores the default scroll behaviour before we scroll (the
      // auto-scroll body would otherwise overwrite the target) and replays
      // once the carousel settles — a brief pause, then ambient motion again.
      // It is a no-op while already paused, so there is no double-start.
      const autoScroll = emblaApi.plugins().autoScroll;
      if (autoScroll) {
        autoScroll.reset();
      }

      const current = emblaApi.selectedScrollSnap();
      const nextIndex =
        (((current + delta) % snapCount) + snapCount) % snapCount;
      emblaApi.scrollTo(nextIndex);
    },
    [emblaApi],
  );

  const handlePrev = () => scrollBySlides(-SLIDES_PER_ARROW_CLICK);
  const handleNext = () => scrollBySlides(SLIDES_PER_ARROW_CLICK);

  return (
    <div className="group relative w-full" data-testid="quick-start-pills">
      {/* -my-4 / py-4 give the pills' shadow (8px below) and hover lift room
          inside the overflow clip without changing the row's layout height. */}
      <div
        ref={emblaRef}
        className="-my-4 w-full overflow-hidden"
        style={{ maskImage: EDGE_FADE, WebkitMaskImage: EDGE_FADE }}
      >
        <div className="flex py-4">
          {/* Never transition `transform` — Embla translates slides with it
              to wrap the loop, and a transition would animate that wrap as a
              visible glide. The hover lift (`translate`) and the `press`
              scale are separate properties (Tailwind v4), so both compose
              with Embla's transform, and `press` never transitions it. */}
          {/* Pills get a tighter drop than `glass` so it fits the clip. */}
          {QUICK_START_EXAMPLES.map((tag) => (
            <button
              key={tag.label}
              type="button"
              onClick={() => handleSelect(tag)}
              className="glass press mr-3 !shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_2px_8px_-2px_rgba(21,102,71,0.14)] inline-flex min-h-[44px] shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-2 font-inter text-[14px] font-normal leading-[20px] text-[#262626] hover:-translate-y-px hover:bg-white/75 motion-reduce:hover:translate-y-0 sm:min-h-0 sm:py-1.5"
            >
              <span>{tag.emoji}</span>
              {tag.label}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={handlePrev}
        aria-label="Previous examples"
        className={cn(ARROW_CLASSES, "left-0")}
      >
        <ChevronLeft className="size-4" />
      </button>
      <button
        type="button"
        onClick={handleNext}
        aria-label="Next examples"
        className={cn(ARROW_CLASSES, "right-0")}
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}
