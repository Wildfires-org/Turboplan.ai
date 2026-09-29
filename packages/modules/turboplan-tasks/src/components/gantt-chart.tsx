import React from "react";

import {
  Gantt,
  Task as GanttTask,
  ViewMode as GanttViewMode,
} from "@wildfires-org/turboplan-gantt-task";
import "@wildfires-org/turboplan-gantt-task/index.css";

import {
  type DateChangedPayload,
  type NormalizedGanttTask,
  type TaskStatus,
  taskStatusLabel,
  type ViewMode,
} from "../types";
import { convertDateToMonthDayYearString } from "../utils";

interface GanttChartProps {
  tasks: NormalizedGanttTask[];
  viewMode: ViewMode;
  viewDate: Date | null;
  columnWidth: number;
  preStepsCount?: boolean;
  isPreview?: boolean;
  isDragging: boolean;
  onDateChange: (payload: DateChangedPayload) => void;
  onTaskClick?: (taskId: string) => void;
  setIsDragging: (isDragging: boolean) => void;
}

export const GanttChart: React.FC<GanttChartProps> = ({
  tasks,
  viewMode,
  viewDate,
  columnWidth,
  preStepsCount,
  isPreview,
  isDragging,
  onDateChange,
  onTaskClick,
  setIsDragging,
}) => {
  // Convert ViewMode to GanttViewMode
  const getGanttViewMode = (mode: ViewMode) => {
    switch (mode) {
      case "Day":
        return GanttViewMode.Day;
      case "Week":
        return GanttViewMode.Week;
      case "Month":
        return GanttViewMode.Month;
      case "Year":
        return GanttViewMode.Year;
      default:
        return GanttViewMode.Month;
    }
  };

  // Custom tooltip component
  const TooltipContent = ({ task }: { task: GanttTask }) => {
    const normalizedTask = task as NormalizedGanttTask;
    return (
      <div className="flex max-w-max flex-col rounded-xl border-0 bg-slate-900 p-2.5 font-inter text-xs tabular-nums text-white shadow-[0_18px_48px_-20px_rgba(15,23,42,0.5)]">
        <div className="font-medium mb-1">{task.name}</div>
        <span>Start date: {convertDateToMonthDayYearString(task.start)}</span>
        <span>Due date: {convertDateToMonthDayYearString(task.end)}</span>
        <span>
          Status: {taskStatusLabel[normalizedTask.status as TaskStatus]}
        </span>
        {normalizedTask.totalTasks && normalizedTask.totalTasks > 0 ? (
          <span>{`Progress: ${normalizedTask.progress}% (${normalizedTask.completedTasks}/${normalizedTask.totalTasks} tasks)`}</span>
        ) : null}
      </div>
    );
  };

  return (
    <div className="w-full">
      <style
        dangerouslySetInnerHTML={{
          __html: `
          .bar g > rect {
            opacity: 0.8;
            transition: opacity 0.2s ease-in-out;
          }
          .bar g > rect:hover {
            opacity: 1;
          }
          .rowLines line {
            stroke: #e3efea;
          }
          .gridBody > .rows rect[data-ishighlighted="true"] {
            transition: fill 0.2s ease-in-out;
            fill: #fff;
            animation: fadeInAndOutHighlightedBgColor 3.5s linear 1 forwards;
          }
          @keyframes fadeInAndOutHighlightedBgColor {
            0% { fill: #fff; }
            10% { fill: #eefcf6; }
            90% { fill: #eefcf6; }
            100% { fill: #fff; }
          }
        `,
        }}
      />
      <Gantt
        tasks={tasks}
        viewMode={getGanttViewMode(viewMode)}
        viewDate={viewDate}
        headerHeight={55}
        todayColor={"transparent"}
        rowHeight={49}
        fontSize="10px"
        fontFamily="Inter, Helvetica Neue, sans-serif"
        arrowColor={"#72767D"}
        columnWidth={columnWidth}
        barFill={55}
        barCornerRadius={8}
        TaskListHeader={() => null}
        TaskListTable={() => null}
        preStepsCount={preStepsCount}
        onDateChange={
          isPreview
            ? undefined
            : (payload: DateChangedPayload) => {
                setIsDragging(true);
                onDateChange(payload);
                setTimeout(() => {
                  setIsDragging(false);
                }, 200);
              }
        }
        onClick={(task: GanttTask) => {
          const normalizedTask = task as NormalizedGanttTask;
          // Don't open details for:
          // - milestones
          // - tasks without path
          // - during dragging
          // - in preview mode
          if (
            normalizedTask.isMilestone ||
            !normalizedTask.path ||
            isDragging ||
            isPreview
          ) {
            return;
          }
          if (onTaskClick) {
            onTaskClick(normalizedTask.path);
          }
        }}
        TooltipContent={TooltipContent}
      />
    </div>
  );
};
