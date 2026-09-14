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
      <div className="bg-black rounded-lg text-white border-0 text-xs font-inter p-2 max-w-max flex flex-col">
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
            stroke: #f3f4f6;
          }
          .gridBody > .rows rect[data-ishighlighted="true"] {
            transition: fill 0.2s ease-in-out;
            fill: #fff;
            animation: fadeInAndOutHighlightedBgColor 3.5s linear 1 forwards;
          }
          @keyframes fadeInAndOutHighlightedBgColor {
            0% { fill: #fff; }
            10% { fill: #fef3c7; }
            90% { fill: #fef3c7; }
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
        arrowColor={"#000"}
        columnWidth={columnWidth}
        barFill={55}
        barCornerRadius={4}
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
