import { useEffect, useMemo, useState } from "react";

import { type MilestoneWithTasks, type ViewMode } from "../types";
import { getDateRangeFromMilestones } from "../utils/gantt-helpers";

interface UseGanttColumnWidthProps {
  viewMode: ViewMode;
  milestones: MilestoneWithTasks[];
  ganttWrapper: HTMLElement | null;
  isPreview?: boolean;
  setGanttViewMode: (viewMode: ViewMode, isAutomatic?: boolean) => void;
  setGanttCanOnlyFitInYearView: (value: boolean) => void;
}

export const useGanttColumnWidth = ({
  viewMode,
  milestones,
  ganttWrapper,
  isPreview = false,
  setGanttViewMode,
  setGanttCanOnlyFitInYearView,
}: UseGanttColumnWidthProps) => {
  const [columnWidth, setColumnWidth] = useState<number>(100);

  // Configuration for minimum widths
  const minWidthConfig: { [key: string]: number } = {
    Day: 60,
    Week: 100,
    Month: 140,
    Year: 180,
  };

  const minColumnsVisible: { [key: string]: number } = {
    Day: 12,
    Week: 9,
    Month: 3,
    Year: 3,
  };

  // Calculate date range from milestones
  const { minDate, maxDate } = useMemo(() => {
    if (milestones.length === 0) {
      const now = new Date();
      return { minDate: now, maxDate: now };
    }

    const allTasks = milestones.flatMap((m) => [m, ...(m.tasks || [])]);
    return getDateRangeFromMilestones(allTasks);
  }, [milestones]);

  // Calculate date difference based on view mode
  const getDatesDifference = (
    viewMode: ViewMode,
    startDate: Date,
    endDate: Date,
  ): number => {
    const msPerDay = 24 * 60 * 60 * 1000;
    const timeDiff = endDate.getTime() - startDate.getTime();
    const daysDiff = Math.ceil(timeDiff / msPerDay);

    switch (viewMode) {
      case "Day":
        return daysDiff;
      case "Week":
        return Math.ceil(daysDiff / 7);
      case "Month":
        return Math.ceil(daysDiff / 30);
      case "Year":
        return Math.ceil(daysDiff / 365);
      default:
        return daysDiff;
    }
  };

  // Get minimum width based on wrapper width and view mode
  const getMinWidth = (
    wrapperWidth: number,
    viewMode: ViewMode,
    isPreview: boolean,
  ): number => {
    if (isPreview) {
      return minWidthConfig[viewMode];
    }

    const minColumns = minColumnsVisible[viewMode];
    const calculatedWidth = Math.floor(wrapperWidth / minColumns);
    return Math.max(calculatedWidth, minWidthConfig[viewMode]);
  };

  // Calculate optimal column width
  const calculateColumnWidth = (
    ganttWidth: number,
    viewMode: ViewMode,
    datesDifference: number,
    wrapperWidth: number,
    isPreview: boolean,
  ): number => {
    const minWidth = getMinWidth(wrapperWidth, viewMode, isPreview);
    const columnWidth = Math.floor(ganttWidth / datesDifference);
    return columnWidth <= minWidth ? minWidth : columnWidth;
  };

  // Update column width when dependencies change
  useEffect(() => {
    if (!ganttWrapper) return;

    const updateWidth = () => {
      const ganttWidth = ganttWrapper.clientWidth;
      const wrapperWidth = ganttWrapper.offsetWidth;
      const datesDifference = getDatesDifference(viewMode, minDate, maxDate);

      if (datesDifference === 0) {
        setColumnWidth(minWidthConfig[viewMode]);
        return;
      }

      const rawWidth = ganttWidth / datesDifference;
      const minWidthFromConfig = minWidthConfig[viewMode];

      // Auto-switch to Year view if columns are too narrow
      if (rawWidth < minWidthFromConfig && viewMode !== "Year") {
        setGanttViewMode("Year", true);
        setGanttCanOnlyFitInYearView(true);
      } else {
        setGanttCanOnlyFitInYearView(false);
      }

      const newWidth = calculateColumnWidth(
        ganttWidth,
        viewMode,
        datesDifference,
        wrapperWidth,
        isPreview,
      );

      setColumnWidth(newWidth);
    };

    // Initial calculation
    updateWidth();

    // Setup ResizeObserver
    const resizeObserver = new ResizeObserver(updateWidth);
    resizeObserver.observe(ganttWrapper);

    return () => {
      resizeObserver.unobserve(ganttWrapper);
    };
  }, [
    ganttWrapper,
    viewMode,
    minDate,
    maxDate,
    isPreview,
    setGanttViewMode,
    setGanttCanOnlyFitInYearView,
  ]);

  return {
    columnWidth,
    minDate,
    maxDate,
  };
};
