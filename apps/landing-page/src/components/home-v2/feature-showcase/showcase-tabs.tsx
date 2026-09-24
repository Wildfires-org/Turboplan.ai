import { motion } from "framer-motion";

import { EASE_IN_OUT } from "@/components/home-v2/ui/motion";
import { cn } from "@/lib/utils";
import type { Tab } from "./types";

const SLIDE_DURATION_MS = 6000;

type ShowcaseTabsProps = {
  tabs: Tab[];
  active: number;
  exiting: number | null;
  phase: number;
  prefersReducedMotion: boolean;
  autoAdvance: boolean;
  onSelect: (index: number) => void;
  onTabEnd: () => void;
};

// Segmented control — the active segment is a white pill that glides between
// tabs (shared layoutId); a hairline at its base doubles as the 6s timer.
export function ShowcaseTabs({
  tabs,
  active,
  exiting,
  phase,
  prefersReducedMotion,
  autoAdvance,
  onSelect,
  onTabEnd,
}: ShowcaseTabsProps) {
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
      return;
    }
    event.preventDefault();
    const delta = event.key === "ArrowRight" ? 1 : -1;
    const next = (active + delta + tabs.length) % tabs.length;
    onSelect(next);
    document.getElementById(`showcase-tab-${next}`)?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label="Product features"
      onKeyDown={handleKeyDown}
      // `isolate` keeps the label/pill z-order below local to the tab row.
      className="isolate flex flex-wrap items-center justify-center gap-1"
    >
      {tabs.map((tab, index) => {
        const isActive = index === active;
        const isExiting = index === exiting;
        return (
          <button
            key={tab.label}
            type="button"
            role="tab"
            id={`showcase-tab-${index}`}
            aria-selected={isActive}
            aria-controls={`showcase-panel-${index}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onSelect(index)}
            className={cn(
              "press group relative whitespace-nowrap rounded-xl px-4 py-2.5",
              // Below lg only the active tab is shown (Moab behaviour) — four
              // segments would wrap into a ragged second row.
              !isActive && "hidden lg:block",
            )}
          >
            {isActive && (
              <motion.span
                layoutId="showcase-tab-indicator"
                transition={
                  prefersReducedMotion
                    ? { duration: 0 }
                    : // On-screen movement → strong ease-in-out.
                      { duration: 0.25, ease: EASE_IN_OUT }
                }
                className="absolute inset-0 z-0 rounded-xl bg-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_1px_2px_rgba(15,23,42,0.06)]"
              />
            )}
            <span
              className={cn(
                // z-10: the gliding pill lives in the *destination* tab, which
                // comes later in the DOM, so mid-glide it would paint over the
                // neighbouring labels it passes. Labels always sit above it.
                "relative z-10 font-heading text-[14px] font-medium leading-[18px] transition-colors duration-200",
                isActive
                  ? "text-neutral-black"
                  : "text-egray-700 group-hover:text-egray-800",
              )}
            >
              {tab.label}
            </span>
            {/* Timer hairline along the segment's base. */}
            <span className="absolute inset-x-4 bottom-1 z-10 h-[2px] overflow-hidden rounded-full">
              {isActive && (
                <span
                  key={`fill-${phase}`}
                  className="showcase-tab-fill absolute inset-0 origin-left rounded-full bg-brand-600"
                  style={{
                    transform: prefersReducedMotion ? "scaleX(1)" : "scaleX(0)",
                    animation: prefersReducedMotion
                      ? "none"
                      : `showcase-tab-fill ${SLIDE_DURATION_MS}ms linear both`,
                    animationPlayState: autoAdvance ? "running" : "paused",
                  }}
                  onAnimationEnd={autoAdvance ? onTabEnd : undefined}
                />
              )}
              {isExiting && !prefersReducedMotion && (
                <span
                  className="absolute inset-0 origin-right rounded-full bg-brand-600"
                  style={{
                    animation:
                      "showcase-tab-shrink 250ms var(--ease-out-expo) both",
                  }}
                />
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
