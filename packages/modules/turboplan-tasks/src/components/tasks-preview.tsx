"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";

import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Clock,
} from "lucide-react";

import { TaskStatus } from "@wildfires-org/turboplan-db";
import { cn } from "@wildfires-org/turboplan-utils";

import { TasksLoadingAnimation } from "./tasks-loading-animation";

// Status icon component for tasks
const StatusIcon = ({ status }: { status: TaskStatus }) => {
  switch (status) {
    case TaskStatus.COMPLETED:
      return <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />;
    case TaskStatus.IN_PROGRESS:
      return <Clock className="size-4 text-blue-500 shrink-0" />;
    case TaskStatus.DELAYED:
      return <AlertCircle className="size-4 text-amber-500 shrink-0" />;
    case TaskStatus.NOT_STARTED:
      return <Circle className="size-4 text-zinc-400 shrink-0" />;
    case TaskStatus.DRAFT:
    default:
      return <Circle className="size-4 text-zinc-300 shrink-0" />;
  }
};

// Status colors for milestone badges
const statusBadgeColors: Record<TaskStatus, string> = {
  [TaskStatus.COMPLETED]:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  [TaskStatus.IN_PROGRESS]:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  [TaskStatus.DELAYED]:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  [TaskStatus.NOT_STARTED]:
    "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  [TaskStatus.DRAFT]:
    "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500",
};

interface ParsedTask {
  id: string;
  title: string;
  status: TaskStatus;
  description?: string;
}

interface ParsedMilestone {
  id: string;
  title: string;
  status: TaskStatus;
  tasks: ParsedTask[];
}

interface TasksPreviewProps {
  content: string;
  className?: string;
}

const COLLAPSED_ITEMS = 4; // Show first 4 items when collapsed

export const TasksPreview = ({ content, className }: TasksPreviewProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const scrollPositionRef = useRef<number>(0);

  // Parse the JSON content to get milestones and tasks
  const milestones = useMemo<ParsedMilestone[]>(() => {
    if (!content) return [];
    try {
      const parsed = JSON.parse(content);
      return parsed.milestones || [];
    } catch {
      return [];
    }
  }, [content]);

  // Calculate total tasks count
  const totalTasks = useMemo(() => {
    return milestones.reduce((acc, m) => acc + (m.tasks?.length || 0), 0);
  }, [milestones]);

  // Flatten milestones and tasks for display with limit
  const displayItems = useMemo(() => {
    const items: Array<
      | { type: "milestone"; data: ParsedMilestone; index: number }
      | { type: "task"; data: ParsedTask; milestoneIndex: number }
    > = [];

    milestones.forEach((milestone, milestoneIndex) => {
      items.push({ type: "milestone", data: milestone, index: milestoneIndex });
      milestone.tasks?.forEach((task) => {
        items.push({ type: "task", data: task, milestoneIndex });
      });
    });

    return items;
  }, [milestones]);

  // Check if we need the expand button
  const needsExpandButton = displayItems.length > COLLAPSED_ITEMS;

  // Items to display based on expanded state
  const visibleItems = isExpanded
    ? displayItems
    : displayItems.slice(0, COLLAPSED_ITEMS);

  // Handle expand/collapse with scroll position preservation
  const handleToggleExpand = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      e.preventDefault();

      // Save current scroll position of the messages container before expanding
      const messagesContainer = document.querySelector(
        '[class*="overflow-y-scroll"][class*="flex-col"]',
      );
      if (messagesContainer) {
        scrollPositionRef.current = messagesContainer.scrollTop;
      }

      setIsExpanded((prev) => !prev);

      // After state update, restore scroll position to prevent jumping
      requestAnimationFrame(() => {
        if (messagesContainer && scrollPositionRef.current > 0) {
          messagesContainer.scrollTop = scrollPositionRef.current;
        }
      });
    },
    [],
  );

  if (milestones.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center py-8 bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-800",
          className,
        )}
      >
        <TasksLoadingAnimation
          size="sm"
          message="Creating tasks & milestones..."
        />
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Tasks list - no height limit when expanded to show all tasks */}
      <div
        className={cn(
          "transition-all duration-200 ease-out",
          isExpanded ? "max-h-none" : "overflow-hidden",
        )}
      >
        <div className="p-4 space-y-1">
          {visibleItems.map((item, idx) => {
            if (item.type === "milestone") {
              return (
                <div
                  key={`milestone-${item.data.id || idx}`}
                  className={cn("flex items-center gap-2", idx > 0 && "mt-3")}
                >
                  <span className="flex items-center justify-center size-5 rounded-full bg-zinc-200 dark:bg-zinc-700 text-xs font-semibold text-zinc-600 dark:text-zinc-300 shrink-0">
                    {item.index + 1}
                  </span>
                  <span className="font-medium text-sm text-zinc-900 dark:text-zinc-100 truncate flex-1">
                    {item.data.title}
                  </span>
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded-full text-xs font-medium shrink-0",
                      statusBadgeColors[item.data.status] ||
                        statusBadgeColors[TaskStatus.DRAFT],
                    )}
                  >
                    {item.data.tasks?.length || 0} tasks
                  </span>
                </div>
              );
            }

            // Task item
            return (
              <div
                key={`task-${item.data.id || idx}`}
                className="flex items-center gap-2 py-1 px-2 ml-7 rounded-md"
              >
                <StatusIcon status={item.data.status} />
                <span
                  className={cn(
                    "text-sm truncate",
                    item.data.status === TaskStatus.COMPLETED
                      ? "text-zinc-500 dark:text-zinc-500 line-through"
                      : "text-zinc-700 dark:text-zinc-300",
                  )}
                >
                  {item.data.title}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Show more/less button - separate element below the list */}
      {needsExpandButton && (
        <div className="border-t border-zinc-100 dark:border-zinc-800 px-4 py-2 z-20">
          <button
            onClick={handleToggleExpand}
            className="w-full flex items-center justify-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors py-1"
          >
            {isExpanded ? (
              <>
                Show less <ChevronUp className="size-3" />
              </>
            ) : (
              <>
                Show all {totalTasks} tasks <ChevronDown className="size-3" />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
