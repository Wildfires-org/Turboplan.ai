import { format } from "date-fns";

import {
  type EntityDates,
  type Milestone,
  type Task,
  TaskStatus,
} from "../types";

/**
 * Parse date string to Date object
 */
export const parseDate = (dateString: string | Date | undefined): Date => {
  if (!dateString) return new Date();
  return new Date(dateString);
};

/**
 * Check if date range is valid (start <= end)
 */
export const isDateRangeValid = (start: Date, end: Date): boolean => {
  return start.getTime() <= end.getTime();
};

/**
 * Check if task/milestone is renderable (has valid dates)
 */
export const isRenderable = (
  entity: Pick<Task | Milestone, "dueDate" | "startDate">,
): boolean => {
  if (!entity.startDate || !entity.dueDate) return true; // Single date or no dates are renderable
  const start = parseDate(entity.startDate);
  const end = parseDate(entity.dueDate);
  return isDateRangeValid(start, end);
};

/**
 * Get normalized dates for Gantt display
 */
export const getEntityDatesForGantt = (
  entity: Pick<Task | Milestone, "dueDate" | "startDate">,
  fallback: {
    fallbackStart?: Date;
    fallbackEnd?: Date;
    milestoneStart?: Date;
    milestoneEnd?: Date;
  } = {},
): EntityDates => {
  const {
    fallbackStart = new Date(),
    fallbackEnd = new Date(),
    milestoneStart,
    milestoneEnd,
  } = fallback;

  // No dates at all - try milestone dates first, then fallback
  if (!entity.startDate && !entity.dueDate) {
    if (milestoneStart && milestoneEnd) {
      return {
        start: milestoneStart,
        end: milestoneEnd,
        isValid: true,
        displayType: "task",
      };
    }
    return {
      start: fallbackStart,
      end: fallbackEnd,
      isValid: true,
      displayType: "noDates",
    };
  }

  // Only due date -> diamond
  if (!entity.startDate && entity.dueDate) {
    return {
      start: parseDate(entity.dueDate),
      end: parseDate(entity.dueDate),
      isValid: true,
      displayType: "diamond",
    };
  }

  // Only start date -> diamond
  if (entity.startDate && !entity.dueDate) {
    return {
      start: parseDate(entity.startDate),
      end: parseDate(entity.startDate),
      isValid: true,
      displayType: "diamond",
    };
  }

  // Invalid date range
  if (!isRenderable(entity)) {
    return {
      start: fallbackStart,
      end: fallbackEnd,
      isValid: false,
      displayType: "noDates",
    };
  }

  // Valid date range
  return {
    start: parseDate(entity.startDate),
    end: parseDate(entity.dueDate),
    isValid: true,
    displayType: "task",
  };
};

/**
 * Convert date to display string
 */
export const convertDateToMonthDayYearString = (date: Date): string => {
  return format(date, "MMM dd, yyyy");
};

/**
 * Calculate progress percentage
 */
export const calculateProgress = (completed: number, total: number): number => {
  if (total === 0) return 0;
  return Math.trunc((completed / total) * 100);
};

/**
 * Get task color based on status
 */
export const getTaskColor = (status: TaskStatus): string => {
  const colors = {
    [TaskStatus.DRAFT]: "#72767D",
    [TaskStatus.NOT_STARTED]: "#000000",
    [TaskStatus.IN_PROGRESS]: "#2768F7",
    [TaskStatus.COMPLETED]: "#00B64C",
    [TaskStatus.DELAYED]: "#ffa726",
  };
  return colors[status] || colors[TaskStatus.NOT_STARTED];
};

/**
 * Debounce function for performance optimization
 */
export const debounce = <T extends (...args: Parameters<T>) => ReturnType<T>>(
  func: T,
  wait: number,
  options: { leading?: boolean; trailing?: boolean } = {},
): T => {
  let timeout: NodeJS.Timeout | undefined;
  let result: ReturnType<T>;

  const debounced = (...args: Parameters<T>): ReturnType<T> => {
    const later = () => {
      timeout = undefined;
      if (options.trailing !== false) {
        result = func(...args) as ReturnType<T>;
      }
    };

    const callNow = options.leading && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);

    if (callNow) {
      result = func(...args) as ReturnType<T>;
    }

    return result;
  };

  return debounced as T;
};

/**
 * Get date range from milestones
 */
export const getDateRangeFromMilestones = (
  milestones: (Task | Milestone)[],
): { minDate: Date; maxDate: Date } => {
  const dates = milestones.reduce((acc, item) => {
    if (item.startDate) acc.push(parseDate(item.startDate));
    if (item.dueDate) acc.push(parseDate(item.dueDate));
    return acc;
  }, [] as Date[]);

  if (dates.length === 0) {
    const now = new Date();
    return { minDate: now, maxDate: now };
  }

  return {
    minDate: new Date(Math.min(...dates.map((d) => d.getTime()))),
    maxDate: new Date(Math.max(...dates.map((d) => d.getTime()))),
  };
};
