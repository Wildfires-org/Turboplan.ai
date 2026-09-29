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

// Per-section icon accents from the design's deco palette (icon only: text
// stays on the neutral/brand scale so it keeps >= 4.5:1 contrast).
const SECTION_CONFIG: Record<
  string,
  { icon: typeof Tag; label: string; iconClass: string }
> = {
  fields: { icon: Tag, label: "Fields", iconClass: "text-[#5A14FF]" },
  documents: {
    icon: FileText,
    label: "Documents",
    iconClass: "text-brand-800",
  },
  milestones: { icon: Flag, label: "Milestones", iconClass: "text-[#1489FF]" },
  context: {
    icon: FileSymlink,
    label: "Relevant Context",
    iconClass: "text-[#4F55C4]",
  },
  timeline: { icon: Clock, label: "Timeline", iconClass: "text-amber-600" },
};

const formatItemNames = (names: string[], max = 3): string => {
  if (names.length <= max) {
    return names.join(", ");
  }
  return `${names.slice(0, max).join(", ")} +${names.length - max} more`;
};

const CountBadge = ({
  count,
  className,
}: {
  count: number;
  className?: string;
}) => {
  return (
    <span
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-50 px-1.5 text-[11px] font-medium leading-4 text-brand-900 ring-1 ring-inset ring-brand-800/15",
        className,
      )}
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
        transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
        className="glass-card flex w-full flex-col gap-3 rounded-[20px] p-3"
      >
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-1.5">
            <CircleCheck className="size-4 text-brand-800" />
            <span className="text-sm font-medium text-brand-800">
              Research saved
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[13px] text-gray-550">
              Items saved to project
            </span>
            <CountBadge
              count={totalSaved}
              className="bg-brand-800 text-white ring-0"
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
                  className="flex items-center gap-2 rounded-xl bg-white py-2 pl-2.5 pr-3 shadow-[0_1px_2px_rgba(15,23,42,0.06)] dark:bg-slate-900"
                >
                  <Icon className={cn("size-4 shrink-0", config.iconClass)} />
                  <span className="text-[13px] font-medium text-foreground">
                    {config.label}
                  </span>
                  <CountBadge count={section.savedCount} />
                  {section.itemNames.length > 0 && (
                    <p className="ml-auto truncate text-xs text-gray-550">
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
