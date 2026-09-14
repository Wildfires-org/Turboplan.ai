import React, { useEffect, useMemo, useRef, useState } from "react";

import { useGanttColumnWidth, useGanttNormalizer } from "../hooks";
import {
  type DateChangedPayload,
  type GanttViewProps,
  TaskStatus,
} from "../types";
import { debounce } from "../utils/gantt-helpers";
import { GanttChart } from "./gantt-chart";

export const GanttView: React.FC<GanttViewProps> = ({
  milestones,
  milestonesOpenStatus,
  viewMode = "Month",
  isPreview = false,
  onDateChange,
  onSetViewMode,
  onSetCanOnlyFitInYearView,
  scrollToDate = null,
  resetScrollToDate,
  addInnerEmptyItem = true,
  importedIds = [],
  preStepsCount = false,
  onTaskClick,
  userId,
}) => {
  const [viewDate, setViewDate] = useState<Date | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const ganttWrapperRef = useRef<HTMLDivElement>(null);
  const previousUpdate = useRef<{ [key: string]: DateChangedPayload }>({});
  const initialViewDateSet = useRef(false);

  // Hooks for data normalization and column width management
  const { normalizeMilestones } = useGanttNormalizer(userId);
  const { columnWidth } = useGanttColumnWidth({
    viewMode,
    milestones,
    ganttWrapper: ganttWrapperRef.current,
    isPreview,
    setGanttViewMode: onSetViewMode,
    setGanttCanOnlyFitInYearView: onSetCanOnlyFitInYearView,
  });

  // Debounced update function for date changes
  const updateDates = debounce(
    (payload: DateChangedPayload) => {
      const prev = previousUpdate.current?.[payload.id];
      const prevEndDate = prev?.end.getTime();
      const prevStartDate = prev?.start.getTime();

      // Check if dates actually changed
      if (
        prevEndDate !== payload.end.getTime() ||
        prevStartDate !== payload.start.getTime()
      ) {
        onDateChange(payload);
      }
      previousUpdate.current[payload.id] = payload;
    },
    200,
    { leading: true, trailing: false },
  );

  // Handle scroll to date
  useEffect(() => {
    if (scrollToDate) {
      setViewDate(scrollToDate);
      initialViewDateSet.current = true; // Mark as set when manually scrolled
      if (resetScrollToDate) {
        resetScrollToDate();
      }
    }
  }, [scrollToDate, resetScrollToDate]);

  // Reset initial view date flag when view mode changes
  useEffect(() => {
    initialViewDateSet.current = false;
  }, [viewMode]);

  // Normalize milestones for Gantt
  const normalizedTasks = useMemo(() => {
    return normalizeMilestones(
      milestones,
      milestonesOpenStatus,
      importedIds,
      addInnerEmptyItem,
    );
  }, [
    normalizeMilestones,
    milestones,
    milestonesOpenStatus,
    importedIds,
    addInnerEmptyItem,
  ]);

  // Explicitly sort by displayOrder to ensure proper order
  const sortedTasks = useMemo(() => {
    return normalizedTasks.sort(
      (a, b) => (a.displayOrder || 0) - (b.displayOrder || 0),
    );
  }, [normalizedTasks]);

  // Add blank space at the bottom to match the "Add Milestone" row in the table (only in edit mode)
  const tasksWithBottomSpace = useMemo(() => {
    if (isPreview) {
      // In preview mode, don't add the spacer row
      return sortedTasks;
    }
    return [
      ...sortedTasks,
      {
        id: "bottom-spacer",
        type: "empty" as const,
        name: "",
        start: new Date(),
        end: new Date(),
        progress: 0,
        dependencies: [],
        isMilestone: false,
        path: "",
        status: TaskStatus.DRAFT,
        displayOrder: sortedTasks.length + 1000, // Ensure it's last
        isTrackHighlighted: false,
      },
    ];
  }, [sortedTasks, isPreview]);

  // Calculate optimal initial view date based on tasks
  useEffect(() => {
    if (
      !scrollToDate &&
      sortedTasks.length > 0 &&
      !initialViewDateSet.current
    ) {
      // Find the earliest start date from all tasks
      const earliestDate = sortedTasks.reduce(
        (earliest, task) => {
          if (task.start && task.start instanceof Date) {
            return !earliest || task.start < earliest ? task.start : earliest;
          }
          return earliest;
        },
        null as Date | null,
      );

      if (earliestDate) {
        // Set view date to a bit before the earliest task to provide some context
        const viewStartDate = new Date(earliestDate);

        // Adjust the view start based on view mode
        switch (viewMode) {
          case "Day":
            viewStartDate.setDate(viewStartDate.getDate() - 7); // Start 7 days before
            break;
          case "Week":
            viewStartDate.setDate(viewStartDate.getDate() - 14); // Start 2 weeks before
            break;
          case "Month":
            viewStartDate.setMonth(viewStartDate.getMonth() - 1); // Start 1 month before
            break;
          case "Year":
            break;
        }

        setViewDate(viewStartDate);
        initialViewDateSet.current = true;
      }
    }
  }, [sortedTasks.length, viewMode, scrollToDate]); // Simplified dependencies

  return (
    <div className="w-full h-full">
      <div className="w-full" ref={ganttWrapperRef}>
        {sortedTasks.length > 0 ? (
          <GanttChart
            tasks={tasksWithBottomSpace}
            viewMode={viewMode}
            viewDate={viewDate}
            columnWidth={columnWidth}
            preStepsCount={preStepsCount}
            isPreview={isPreview}
            isDragging={isDragging}
            onDateChange={updateDates}
            onTaskClick={onTaskClick}
            setIsDragging={setIsDragging}
          />
        ) : (
          <div className="flex items-center justify-center h-64 text-gray-500">
            <div className="text-center">
              <h3 className="text-lg font-medium mb-2">No tasks to display</h3>
              <p>
                Create some milestones and tasks to see them in the Gantt chart.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
