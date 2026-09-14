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

// Tab strip — Moab-style: natural-width labels on one line, each with its own
// text-width underline that doubles as the 6s timer.
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
      className="flex flex-wrap items-center justify-center gap-6 md:gap-10"
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
              "group relative whitespace-nowrap px-0.5 pb-2 pt-1.5 transition-colors",
              // Mobile: only the active tab is shown (Moab behaviour).
              !isActive && "hidden md:block",
            )}
          >
            <span
              className={cn(
                "font-heading text-[14px] font-medium leading-[18px] transition-colors",
                isActive
                  ? "text-neutral-black"
                  : "text-egray-500 group-hover:text-egray-700",
              )}
            >
              {tab.label}
            </span>
            {/* Underline spans exactly the label width (button is natural
                width with only 2px side padding). */}
            <span className="absolute inset-x-0 bottom-0 h-[2px] overflow-hidden rounded-full bg-egray-100">
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
              {isExiting && (
                <span
                  className="absolute inset-0 origin-right rounded-full bg-brand-600"
                  style={{
                    animation: "showcase-tab-shrink 500ms linear both",
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
