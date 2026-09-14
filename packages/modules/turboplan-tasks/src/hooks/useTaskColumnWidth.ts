import { useEffect, useRef, useState } from "react";

import { type MilestoneWithTasks, TaskStatus } from "../types";

interface UseTaskColumnWidthProps {
  milestones: MilestoneWithTasks[];
  minWidth?: number;
  maxWidth?: number;
  padding?: number;
}

export const useTaskColumnWidth = ({
  milestones,
  minWidth = 200,
  maxWidth = 400,
  padding = 40,
}: UseTaskColumnWidthProps) => {
  const [taskColumnWidth, setTaskColumnWidth] = useState(minWidth);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Safety check - ensure milestones is always an array
  const safeMilestones = Array.isArray(milestones) ? milestones : [];

  const measureText = (text: string, element?: HTMLElement): number => {
    if (!canvasRef.current) {
      canvasRef.current = document.createElement("canvas");
    }

    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    if (!context) return 0;

    // Get font from actual DOM element - if not available, return 0 to use default width
    let font: string;

    if (element) {
      const computedStyle = window.getComputedStyle(element);
      font = `${computedStyle.fontSize} ${computedStyle.fontFamily}`;
    } else {
      // Try to find existing milestone or task element to get font from
      const milestoneElement = document.querySelector("[data-milestone-title]");
      const taskElement = document.querySelector("[data-task-title]");

      if (milestoneElement) {
        const computedStyle = window.getComputedStyle(milestoneElement);
        font = `${computedStyle.fontSize} ${computedStyle.fontFamily}`;
      } else if (taskElement) {
        const computedStyle = window.getComputedStyle(taskElement);
        font = `${computedStyle.fontSize} ${computedStyle.fontFamily}`;
      } else {
        // No DOM elements available - cannot measure accurately
        return 0;
      }
    }

    context.font = font;
    return context.measureText(text).width;
  };

  useEffect(() => {
    if (safeMilestones.length === 0) {
      setTaskColumnWidth(minWidth);
      return;
    }

    let maxTextWidth = 0;
    let canMeasureText = false;

    // Measure milestone titles
    for (const milestone of safeMilestones) {
      const milestoneTitle = `${milestone.title} (${
        milestone.tasks?.length || 0
      })`;
      const textWidth = measureText(milestoneTitle);

      if (textWidth > 0) {
        canMeasureText = true;
        // Add space for chevron button (~20px) + gap-2 (8px) + px-4 padding (32px) = 70px
        const milestoneWidth = textWidth + 70;
        maxTextWidth = Math.max(maxTextWidth, milestoneWidth);
      }

      // Measure task titles (with indentation)
      if (milestone.tasks) {
        for (const task of milestone.tasks) {
          const taskElement = document.querySelector(
            `[data-task-title="${task.id}"]`,
          ) as HTMLElement;
          const taskTextWidth = measureText(
            task.title,
            taskElement || undefined,
          );

          if (taskTextWidth > 0) {
            canMeasureText = true;
            // Add padding for task indentation: pl-8 (32px) + px-4 (16px) = 48px
            // Add space for check icon if completed: icon (16px) + gap (8px) = 24px
            const checkIconSpace =
              task.status === TaskStatus.COMPLETED ? 24 : 0;
            const taskWidth = taskTextWidth + 48 + checkIconSpace;
            maxTextWidth = Math.max(maxTextWidth, taskWidth);
          }
        }
      }
    }

    // If we can't measure text accurately, use default width
    if (!canMeasureText) {
      setTaskColumnWidth(300);
      return;
    }

    // No additional padding needed since we already calculated it above
    const calculatedWidth = maxTextWidth;
    const finalWidth = Math.min(Math.max(calculatedWidth, minWidth), maxWidth);

    setTaskColumnWidth(Math.ceil(finalWidth));
  }, [safeMilestones, minWidth, maxWidth, padding]);

  return taskColumnWidth;
};
