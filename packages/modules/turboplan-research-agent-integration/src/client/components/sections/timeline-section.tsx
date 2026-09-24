"use client";

import { useCallback } from "react";

import { CheckCheck, Clock } from "lucide-react";

import { Checkbox } from "@wildfires-org/turboplan-utils";

import type { TimelineItem } from "../../../types";
import { useSectionSaveRegistration } from "../../contexts/save-to-project-context";
import { useIndexSelection } from "../../hooks/use-index-selection";
import { useSaveToProject } from "../../hooks/use-save-to-project";
import {
  ResearchSectionBody,
  ResearchSectionHeader,
  ResearchSectionRoot,
  SelectAllControl,
} from "../ui/research-section";
import { SectionItemCard } from "../ui/section-item";

type TimelineSectionProps = {
  messageId: string;
  projectId?: string;
  timeline: TimelineItem[];
};

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const formatDateRange = (startedAt?: string, endedAt?: string) => {
  if (!startedAt) {
    return null;
  }
  if (endedAt) {
    return `${formatDate(startedAt)} → ${formatDate(endedAt)}`;
  }
  return formatDate(startedAt);
};

export function TimelineSection({
  messageId,
  projectId,
  timeline,
}: TimelineSectionProps) {
  const { save, isSaving } = useSaveToProject(messageId, "timeline", projectId);
  const isSelectable = useCallback((item: TimelineItem) => !item.saved, []);
  const {
    selectedIndices,
    selectedCount,
    selectableIndices,
    isAllSelected,
    isIndexSelected,
    toggleIndex,
    toggleAll,
    clear,
  } = useIndexSelection({
    items: timeline,
    isSelectable,
  });

  const handleSave = useCallback(async () => {
    if (selectedCount === 0) {
      return null;
    }
    try {
      const itemNames = [...selectedIndices].map((i) => timeline[i].title);
      const result = await save({ itemIndices: [...selectedIndices] });
      if (result) {
        return { savedCount: result.savedCount, itemNames };
      }
      return null;
    } catch (error) {
      console.error("[TimelineSection] Save failed:", error);
      return null;
    }
  }, [save, selectedCount, selectedIndices, timeline]);

  useSectionSaveRegistration("timeline", selectedCount, handleSave, clear);

  if (timeline.length === 0) {
    return null;
  }

  return (
    <ResearchSectionRoot tone="amber">
      <ResearchSectionHeader
        tone="amber"
        icon={<Clock className="size-4" />}
        title="Project Timeline"
        count={timeline.length}
        actions={
          selectableIndices.length > 0 ? (
            <SelectAllControl
              checked={isAllSelected}
              onChange={toggleAll}
              disabled={isSaving}
            />
          ) : undefined
        }
      />
      <ResearchSectionBody>
        {timeline.map((item, index) => {
          const dateRange = formatDateRange(item.startedAt, item.endedAt);

          return (
            <SectionItemCard key={`${item.title}-${index}`} layout="row">
              {item.saved ? (
                <CheckCheck className="size-4 text-brand-700 shrink-0" />
              ) : (
                <Checkbox
                  checked={isIndexSelected(index)}
                  onCheckedChange={() => toggleIndex(index)}
                  disabled={isSaving}
                  aria-label={`Select timeline item ${item.title}`}
                  variant="dark"
                />
              )}
              <div className="flex-1 min-w-0 leading-4">
                <span className="text-xs text-neutral-700 font-semibold">
                  {item.title}
                </span>
                {item.description && (
                  <p className="text-xs text-gray-550 mt-1">
                    {item.description}
                  </p>
                )}
                {dateRange && (
                  <p className="text-xs text-gray-550 mt-1">{dateRange}</p>
                )}
              </div>
            </SectionItemCard>
          );
        })}
      </ResearchSectionBody>
    </ResearchSectionRoot>
  );
}
