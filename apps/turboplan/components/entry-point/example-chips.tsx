"use client";

import { useId, useRef, useState } from "react";

import {
  Axe,
  Bug,
  ChevronDown,
  Compass,
  Construction,
  Fish,
  Flame,
  Footprints,
  Leaf,
  type LucideIcon,
  MountainSnow,
  PawPrint,
  Pickaxe,
  Route,
  Shovel,
  Sprout,
  Tent,
  TreePine,
  Trees,
  UtilityPole,
  Warehouse,
  Waves,
  Wheat,
} from "lucide-react";

import type { EntryExample, EntryExampleIcon } from "@/lib/entry-point/types";
import { cn } from "@/lib/utils";

interface ExampleChipsProps {
  label: string;
  examples: EntryExample[];
  onSelect: (example: EntryExample) => void;
}

const ICONS: Record<EntryExampleIcon, LucideIcon> = {
  axe: Axe,
  bug: Bug,
  compass: Compass,
  construction: Construction,
  fish: Fish,
  flame: Flame,
  footprints: Footprints,
  leaf: Leaf,
  "mountain-snow": MountainSnow,
  "paw-print": PawPrint,
  pickaxe: Pickaxe,
  route: Route,
  shovel: Shovel,
  sprout: Sprout,
  tent: Tent,
  "tree-pine": TreePine,
  trees: Trees,
  "utility-pole": UtilityPole,
  warehouse: Warehouse,
  waves: Waves,
  wheat: Wheat,
};

// Shown before "more": two rows on a desktop, a few lines on a phone.
const COLLAPSED_COUNT = 6;

const CHIP_CLASS =
  "inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-4 text-[14px] font-medium leading-5 text-gray-950 shadow-[0_8px_18px_-14px_rgba(11,13,15,0.45)] ring-1 ring-black/[0.08] transition-[box-shadow,transform] duration-200 hover:-translate-y-px hover:ring-black/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:min-h-10";

/**
 * Example projects under the prompt. Choosing one puts its prompt in the box;
 * the rest of the set opens behind a "more" toggle.
 */
export function ExampleChips({ label, examples, onSelect }: ExampleChipsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const labelId = useId();
  const listId = useId();
  // First chip the toggle reveals, so keyboard focus lands on the new ones.
  const firstRevealedRef = useRef<HTMLButtonElement>(null);

  const hiddenCount = Math.max(examples.length - COLLAPSED_COUNT, 0);
  const visibleExamples = isExpanded
    ? examples
    : examples.slice(0, COLLAPSED_COUNT);

  const handleToggle = () => {
    if (isExpanded) {
      setIsExpanded(false);
      return;
    }
    setIsExpanded(true);
    requestAnimationFrame(() => {
      firstRevealedRef.current?.focus();
    });
  };

  if (examples.length === 0) {
    return null;
  }

  return (
    <div>
      <p
        id={labelId}
        className="text-center text-[13px] font-medium uppercase tracking-[0.08em] text-gray-550"
      >
        {label}
      </p>
      <ul
        id={listId}
        aria-labelledby={labelId}
        className="mt-4 flex flex-wrap justify-center gap-2"
      >
        {visibleExamples.map((example, index) => {
          const Icon = ICONS[example.icon];
          return (
            <li key={example.id}>
              <button
                ref={index === COLLAPSED_COUNT ? firstRevealedRef : undefined}
                type="button"
                onClick={() => onSelect(example)}
                className={CHIP_CLASS}
              >
                <Icon aria-hidden className="size-4 shrink-0 text-brand-600" />
                {example.label}
              </button>
            </li>
          );
        })}
        {hiddenCount > 0 && (
          <li>
            <button
              type="button"
              aria-expanded={isExpanded}
              aria-controls={listId}
              onClick={handleToggle}
              className={cn(
                CHIP_CLASS,
                "bg-transparent text-gray-550 shadow-none hover:text-gray-950",
              )}
            >
              {isExpanded ? "Fewer examples" : `${hiddenCount} more examples`}
              <ChevronDown
                aria-hidden
                className={cn(
                  "size-4 shrink-0 transition-transform duration-200 motion-reduce:transition-none",
                  isExpanded && "rotate-180",
                )}
              />
            </button>
          </li>
        )}
      </ul>
    </div>
  );
}
