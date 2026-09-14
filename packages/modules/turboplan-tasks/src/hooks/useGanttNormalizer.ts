import { useMemo } from "react";

import { TMP_TASK_PREPEND } from "../components/table/constants";
import {
  type GanttStyleConfig,
  type Milestone,
  type MilestoneWithTasks,
  type NormalizedGanttTask,
  type Task,
  TaskStatus,
  taskStatusBackgroundColor,
} from "../types";
import {
  calculateProgress,
  getEntityDatesForGantt,
  isRenderable,
} from "../utils/gantt-helpers";
import { useTaskStyles } from "./useTaskStyles";

export const useGanttNormalizer = (userId?: string) => {
  const { getTaskStyles } = useTaskStyles();

  const normalizeMilestones = useMemo(() => {
    return (
      milestonesData: MilestoneWithTasks[],
      milestonesOpenStatus: { [key: string]: boolean },
      importedIds: string[] = [],
      addInnerEmptyItem?: boolean,
    ): NormalizedGanttTask[] => {
      const normalizedTasks: NormalizedGanttTask[] = [];
      let globalDisplayOrder = 1; // Global sequential counter for displayOrder (start from 1 to avoid JS falsy issue)

      // Sort milestones by order field before processing
      const sortedMilestones = [...milestonesData].sort(
        (a, b) => a.order - b.order,
      );

      sortedMilestones.forEach((milestone, milestoneIndex) => {
        const taskStyles = getTaskStyles({ index: milestoneIndex });

        // Add milestone itself
        const milestoneGantt = buildGanttItem(
          milestone,
          "milestone",
          globalDisplayOrder, // Use current counter value
          taskStyles,
          importedIds,
        );
        globalDisplayOrder++; // Then increment
        normalizedTasks.push(milestoneGantt);

        // Add milestone tasks if expanded
        if (milestonesOpenStatus[milestone.id]) {
          // Add milestone tasks if they exist
          if (milestone.tasks?.length > 0) {
            // Sort tasks by order field before processing
            const sortedTasks = [...milestone.tasks].sort(
              (a, b) => a.order - b.order,
            );

            sortedTasks.forEach((task, taskIndex) => {
              // Filter out temporary tasks (starting with TMP_TASK_PREPEND) from Gantt
              if (isRenderable(task) && !task.id.startsWith(TMP_TASK_PREPEND)) {
                const taskGantt = buildGanttItem(
                  task,
                  "task",
                  globalDisplayOrder, // Use current counter value
                  taskStyles,
                  importedIds,
                  milestone, // Pass milestone for date inheritance
                  taskIndex, // Pass task index for date distribution
                  sortedTasks.length, // Pass total tasks for date distribution
                );
                globalDisplayOrder++; // Then increment
                normalizedTasks.push(taskGantt);
              }
            });
          }

          // Add empty item for "+ Add Task" button - only when milestone is expanded
          if (addInnerEmptyItem) {
            normalizedTasks.push(
              createEmptyTaskItem(milestone, globalDisplayOrder, taskStyles),
            );
            globalDisplayOrder++; // Then increment
          }
        }
      });

      return normalizedTasks;
    };
  }, [getTaskStyles, userId]);

  const buildGanttItem = (
    item: Task | Milestone,
    type: "task" | "milestone",
    displayOrder: number,
    taskStyles: GanttStyleConfig,
    importedIds: string[],
    parentMilestone?: Milestone,
    taskIndex?: number,
    totalTasksInMilestone?: number,
  ): NormalizedGanttTask => {
    const isMilestone = type === "milestone";
    const isTask = type === "task";

    // Calculate progress for milestones
    let progress = 0;
    let totalTasks = 0;
    let completedTasks = 0;

    if (isMilestone) {
      const milestone = item as MilestoneWithTasks;
      totalTasks = milestone.tasks?.length || 0;
      completedTasks =
        milestone.tasks?.filter((t) => t.status === TaskStatus.COMPLETED)
          .length || 0;
      progress = calculateProgress(completedTasks, totalTasks);
    } else {
      // For tasks, progress is based on status
      progress =
        item.status === TaskStatus.COMPLETED
          ? 100
          : item.status === TaskStatus.IN_PROGRESS
            ? 50
            : 0;
    }

    // Get normalized dates with milestone inheritance for tasks
    let dates;
    if (
      isTask &&
      parentMilestone &&
      typeof taskIndex === "number" &&
      totalTasksInMilestone
    ) {
      // For tasks without dates, distribute them across milestone timespan
      const milestoneStart = parentMilestone.startDate
        ? new Date(parentMilestone.startDate)
        : undefined;
      const milestoneEnd = parentMilestone.dueDate
        ? new Date(parentMilestone.dueDate)
        : undefined;

      if (milestoneStart && milestoneEnd && !item.startDate && !item.dueDate) {
        // Distribute tasks evenly across milestone timespan
        const totalDuration = milestoneEnd.getTime() - milestoneStart.getTime();
        const taskDuration = totalDuration / totalTasksInMilestone;
        const taskStart = new Date(
          milestoneStart.getTime() + taskIndex * taskDuration,
        );
        const taskEnd = new Date(taskStart.getTime() + taskDuration);

        dates = {
          start: taskStart,
          end: taskEnd,
          isValid: true,
          displayType: "task" as const,
        };
      } else {
        dates = getEntityDatesForGantt(item, {
          milestoneStart,
          milestoneEnd,
        });
      }
    } else {
      dates = getEntityDatesForGantt(item);
    }

    // Generate task name with progress
    const progressLabel =
      isMilestone && totalTasks > 0 ? ` (${completedTasks}/${totalTasks})` : "";

    return {
      id: item.id,
      name: item.title + progressLabel,
      start: dates.start,
      end: dates.end,
      progress,
      dependencies: isTask ? (item as Task).dependencies || [] : [], // Pass actual task dependencies
      type: dates.displayType === "diamond" ? "milestone" : "task",
      isMilestone,
      path: item.id,
      status: item.status,
      totalTasks,
      completedTasks,
      isTrackHighlighted: importedIds.includes(item.id),
      styles: {
        backgroundColor: taskStatusBackgroundColor[item.status],
        backgroundSelectedColor: taskStatusBackgroundColor[item.status],
        progressColor: taskStatusBackgroundColor[item.status],
        progressSelectedColor: taskStatusBackgroundColor[item.status],
        ...taskStyles.initiated,
      },
      isDisabled: false,
      project: isMilestone ? item.id : (item as Task).milestoneId,
      hideChildren: false,
      displayOrder: displayOrder,
    };
  };

  const createEmptyTaskItem = (
    milestone: Milestone,
    displayOrder: number,
    taskStyles: GanttStyleConfig,
  ): NormalizedGanttTask => {
    const now = new Date();
    return {
      id: `empty-${milestone.id}`,
      name: "",
      start: now,
      end: now,
      progress: 0,
      dependencies: [],
      type: "empty",
      isMilestone: false,
      path: "",
      status: TaskStatus.NOT_STARTED,
      totalTasks: 0,
      completedTasks: 0,
      isTrackHighlighted: false,
      styles: {
        backgroundColor: "transparent", // Make invisible in Gantt
        backgroundSelectedColor: "transparent",
        progressColor: "transparent",
        progressSelectedColor: "transparent",
        ...taskStyles.notInitiated,
      },
      isDisabled: true,
      project: milestone.id,
      hideChildren: false,
      displayOrder: displayOrder,
    };
  };

  return {
    normalizeMilestones,
  };
};
