"use client";

import { useCallback } from "react";

import { CheckCheck, Flag } from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Checkbox,
} from "@wildfires-org/turboplan-utils";

import type { MilestoneItem } from "../../../types";
import { useSectionSaveRegistration } from "../../contexts/save-to-project-context";
import { useMilestoneTaskSelection } from "../../hooks/use-milestone-task-selection";
import { useSaveToProject } from "../../hooks/use-save-to-project";
import {
  ResearchSectionBody,
  ResearchSectionHeader,
  ResearchSectionRoot,
  SelectAllControl,
} from "../ui/research-section";
import { sectionItemSurfaceVariants } from "../ui/section-item";
import { SectionPill } from "../ui/section-pill";

const formatDate = (date: string) => {
  try {
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) {
      return date;
    }
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(parsed);
  } catch {
    return date;
  }
};

const formatDateRange = (startDate?: string, dueDate?: string) => {
  if (!startDate && !dueDate) return null;
  if (startDate && dueDate)
    return `${formatDate(startDate)} - ${formatDate(dueDate)}`;
  if (startDate) return `From ${formatDate(startDate)}`;
  return `Due ${formatDate(dueDate!)}`;
};

type MilestonesSectionProps = {
  messageId: string;
  projectId?: string;
  milestones: MilestoneItem[];
};

export function MilestonesSection({
  messageId,
  projectId,
  milestones,
}: MilestonesSectionProps) {
  const { save, isSaving } = useSaveToProject(
    messageId,
    "milestones",
    projectId,
  );
  const {
    selectedTasksCount,
    selectableTaskCount,
    isAllSelected,
    getMilestoneState,
    isTaskSelected,
    toggleAll,
    toggleMilestone,
    toggleTask,
    clear,
    toSaveSelections,
  } = useMilestoneTaskSelection(milestones);

  const handleSave = useCallback(async () => {
    if (selectedTasksCount === 0) {
      return null;
    }
    try {
      const selections = toSaveSelections();
      const itemNames = selections.map(
        (s) => milestones[s.milestoneIndex].title,
      );
      const result = await save({ selections });
      if (result) {
        return { savedCount: result.savedCount, itemNames };
      }
      return null;
    } catch (error) {
      console.error("[MilestonesSection] Save failed:", error);
      return null;
    }
  }, [save, selectedTasksCount, toSaveSelections, milestones]);

  useSectionSaveRegistration(
    "milestones",
    selectedTasksCount,
    handleSave,
    clear,
  );

  const firstExpandableMilestoneIndex = milestones.findIndex(
    (milestone) => milestone.tasks.length > 0,
  );

  return (
    <ResearchSectionRoot tone="blue">
      <ResearchSectionHeader
        tone="blue"
        icon={<Flag className="size-4" />}
        title="Suggested Milestones"
        count={milestones.length}
        actions={
          selectableTaskCount > 0 ? (
            <SelectAllControl
              checked={isAllSelected}
              onChange={toggleAll}
              disabled={isSaving}
            />
          ) : undefined
        }
      />
      <ResearchSectionBody className="gap-0">
        <Accordion
          type="multiple"
          defaultValue={
            firstExpandableMilestoneIndex >= 0
              ? [`milestone-${firstExpandableMilestoneIndex}`]
              : undefined
          }
          className="flex flex-col gap-2"
        >
          {milestones.map((milestone, index) => {
            const hasTasks = milestone.tasks.length > 0;
            const milestoneState = getMilestoneState(index);

            return (
              <AccordionItem
                key={milestone.artifactId ?? index}
                value={`milestone-${index}`}
                className={sectionItemSurfaceVariants()}
              >
                {hasTasks ? (
                  <div className="flex items-start gap-3">
                    <div className="pt-0.5 shrink-0">
                      {milestone.saved ? (
                        <CheckCheck className="size-4 text-brand-700" />
                      ) : (
                        <Checkbox
                          checked={
                            milestoneState.isIndeterminate
                              ? "indeterminate"
                              : milestoneState.isChecked
                          }
                          onCheckedChange={() => toggleMilestone(index)}
                          disabled={
                            isSaving ||
                            !hasTasks ||
                            milestoneState.unsavedTaskIndices.length === 0
                          }
                          aria-label={`Select milestone ${milestone.title}`}
                          variant="dark"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <AccordionTrigger className="gap-3 p-0 text-left hover:no-underline">
                        <div className="min-w-0 flex-1">
                          <span className="text-xs text-neutral-700 font-semibold leading-4 line-clamp-2">
                            {milestone.title}
                          </span>
                          {formatDateRange(
                            milestone.startDate,
                            milestone.dueDate,
                          ) && (
                            <span className="text-xs text-gray-550 leading-4 block mt-0.5">
                              {formatDateRange(
                                milestone.startDate,
                                milestone.dueDate,
                              )}
                            </span>
                          )}
                        </div>
                        <div className="w-16 shrink-0 flex items-center justify-end">
                          <SectionPill
                            tone="secondary"
                            weight="strong"
                            align="center"
                            className="px-2"
                          >
                            {milestone.tasks.length} task
                            {milestone.tasks.length > 1 ? "s" : ""}
                          </SectionPill>
                        </div>
                      </AccordionTrigger>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-[16px_1fr] items-center gap-3">
                    <div className="pt-0.5">
                      {milestone.saved ? (
                        <CheckCheck className="size-4 text-brand-700" />
                      ) : (
                        <Checkbox
                          checked={false}
                          onCheckedChange={() => undefined}
                          disabled
                          aria-label={`Milestone ${milestone.title} cannot be selected`}
                          variant="dark"
                        />
                      )}
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs text-neutral-700 font-semibold leading-4 line-clamp-2">
                        {milestone.title}
                      </span>
                      {formatDateRange(
                        milestone.startDate,
                        milestone.dueDate,
                      ) && (
                        <span className="text-xs text-gray-550 leading-4 block mt-0.5">
                          {formatDateRange(
                            milestone.startDate,
                            milestone.dueDate,
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {hasTasks && (
                  <AccordionContent>
                    <div className="pt-2">
                      <div className="relative ml-3 pl-8">
                        <div
                          aria-hidden="true"
                          className="absolute left-2 top-0 bottom-0 w-px bg-neutral-200 dark:bg-neutral-800"
                        />
                        {milestone.tasks.map((task, taskIndex) => (
                          <div
                            key={task.artifactId ?? taskIndex}
                            className="relative flex items-start gap-2 py-1.5"
                          >
                            {milestone.saved || (task.saved ?? false) ? (
                              <CheckCheck className="size-3.5 text-brand-700 shrink-0 mt-0.5" />
                            ) : (
                              <Checkbox
                                checked={isTaskSelected(index, taskIndex)}
                                onCheckedChange={() =>
                                  toggleTask(index, taskIndex)
                                }
                                disabled={isSaving}
                                aria-label={`Select task ${task.title}`}
                                variant="dark"
                                className="shrink-0 mt-0.5"
                              />
                            )}
                            <div className="min-w-0">
                              <span className="text-xs text-neutral-700 font-semibold leading-4 block">
                                {task.title}
                              </span>
                              {(task.saved ?? false) && (
                                <span className="text-xs text-brand-800 leading-snug block mt-0.5">
                                  Saved
                                </span>
                              )}
                              {task.description && (
                                <span className="text-xs text-gray-550 leading-4 block mt-0.5">
                                  {task.description}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </AccordionContent>
                )}
              </AccordionItem>
            );
          })}
        </Accordion>
      </ResearchSectionBody>
    </ResearchSectionRoot>
  );
}
