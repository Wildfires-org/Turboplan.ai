"use client";

import {
  BookOpen,
  CheckSquare,
  Clock,
  FileText,
  List,
  Map,
  MessageSquare,
} from "lucide-react";

import {
  MODULE_DISPLAY_NAMES,
  type ProjectModule,
} from "@wildfires-org/turboplan-db/types";
import { Button } from "@wildfires-org/turboplan-utils";

import { cn } from "@/lib/utils";

interface AddSectionsBarProps {
  hiddenModules: string[];
  allModules: string[];
  onToggle: (moduleName: string) => void;
  isLoading?: boolean;
}

// Map module IDs to their respective icons
const MODULE_ICONS: Record<
  ProjectModule,
  React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>
> = {
  map: Map,
  tasks: CheckSquare,
  fields: List,
  context: BookOpen,
  documents: FileText,
  comments: MessageSquare,
  timeline: Clock,
};

export function AddSectionsBar({
  hiddenModules,
  allModules,
  onToggle,
  isLoading = false,
}: AddSectionsBarProps) {
  if (hiddenModules.length === 0) {
    return null;
  }

  const hiddenSet = new Set(hiddenModules);

  return (
    <div
      className="flex items-start gap-3 py-4"
      role="region"
      aria-label="Section visibility"
    >
      <span
        className="flex h-8 shrink-0 items-center text-sm leading-5 text-gray-800"
        id="add-sections-label"
      >
        Add section(s):
      </span>
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-labelledby="add-sections-label"
      >
        {allModules.map((moduleName) => {
          const displayName =
            MODULE_DISPLAY_NAMES[moduleName as ProjectModule] || moduleName;
          const IconComponent = MODULE_ICONS[moduleName as ProjectModule];
          const isHidden = hiddenSet.has(moduleName);

          return (
            <Button
              key={moduleName}
              variant="outline"
              size="sm"
              onClick={() => onToggle(moduleName)}
              disabled={isLoading}
              className={cn(
                "gap-1 rounded-full border-gray-250 bg-white py-1.5 pl-2.5 pr-3 text-sm font-medium hover:bg-accent",
                isHidden ? "text-gray-950" : "text-gray-325",
              )}
              aria-label={
                isHidden
                  ? `Add ${displayName} section back to project`
                  : `Hide ${displayName} section from project`
              }
              title={isHidden ? `Show ${displayName}` : `Hide ${displayName}`}
            >
              {IconComponent && (
                <IconComponent className="size-4 shrink-0" aria-hidden />
              )}
              <span>{displayName}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
