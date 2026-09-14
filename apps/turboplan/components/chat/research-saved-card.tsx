"use client";

import { motion } from "framer-motion";
import {
  CircleCheck,
  Clock,
  FileSymlink,
  FileText,
  Flag,
  Tag,
} from "lucide-react";

import { cn } from "@/lib/utils";

type SavedSection = {
  sectionKey: string;
  savedCount: number;
  itemNames: string[];
};

type ResearchSavedCardProps = {
  sections: SavedSection[];
  totalSaved: number;
};

// Per-section accent colors come from the design's deco palette, which has no
// matching Tailwind token — applied via inline style since the value is dynamic.
const SECTION_CONFIG: Record<
  string,
  { icon: typeof Tag; label: string; color: string }
> = {
  fields: { icon: Tag, label: "Fields", color: "#5A14FF" },
  documents: { icon: FileText, label: "Documents", color: "#10B981" },
  milestones: { icon: Flag, label: "Milestones", color: "#1489FF" },
  context: { icon: FileSymlink, label: "Relevant Context", color: "#4F55C4" },
  timeline: { icon: Clock, label: "Timeline", color: "#E2D007" },
};

const SAVED_GREEN = "#05B871";

const formatItemNames = (names: string[], max = 3): string => {
  if (names.length <= max) {
    return names.join(", ");
  }
  return `${names.slice(0, max).join(", ")} +${names.length - max} more`;
};

type CountBadgeProps = {
  count: number;
  color: string;
  className?: string;
};

const CountBadge = ({ count, color, className }: CountBadgeProps) => {
  return (
    <span
      className={cn(
        "inline-flex min-w-4 items-center justify-center rounded-full px-1.5 text-[10px] font-medium leading-4 text-white",
        className,
      )}
      style={{ backgroundColor: color }}
    >
      {count}
    </span>
  );
};

export const ResearchSavedCard = ({
  sections,
  totalSaved,
}: ResearchSavedCardProps) => {
  const visibleSections = sections.filter(
    (section) => SECTION_CONFIG[section.sectionKey] && section.savedCount > 0,
  );

  return (
    <div className="mx-auto w-full max-w-3xl px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="flex w-full flex-col gap-3 rounded-lg border border-brandAlt-200 bg-brandAlt-100 p-3"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <CircleCheck className="size-4 text-[#05B871]" />
            <span className="text-sm font-semibold text-[#05B871]">
              Research saved
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-brand-700">
              Items saved to project
            </span>
            <CountBadge
              count={totalSaved}
              color={SAVED_GREEN}
              className="size-5 px-2 text-xs"
            />
          </div>
        </div>

        {visibleSections.length > 0 && (
          <div className="flex flex-col gap-1">
            {visibleSections.map((section) => {
              const config = SECTION_CONFIG[section.sectionKey];
              const Icon = config.icon;

              return (
                <div
                  key={section.sectionKey}
                  className="flex items-center gap-2 rounded-md border border-neutral-100 bg-white py-2 pl-2 pr-3 shadow-sm"
                >
                  <Icon
                    className="size-4 shrink-0"
                    style={{ color: config.color }}
                  />
                  <span
                    className="text-[13px] font-semibold"
                    style={{ color: config.color }}
                  >
                    {config.label}
                  </span>
                  <CountBadge count={section.savedCount} color={config.color} />
                  {section.itemNames.length > 0 && (
                    <p className="ml-auto truncate text-xs tracking-[0.02em] text-neutral-400">
                      {formatItemNames(section.itemNames)}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
};
