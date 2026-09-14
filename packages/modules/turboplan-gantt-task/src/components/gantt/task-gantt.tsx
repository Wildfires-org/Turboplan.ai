import React, { useEffect, useImperativeHandle, useRef, useState } from "react";

import { Calendar, CalendarProps } from "../calendar/calendar";
import { Grid, GridProps } from "../grid/grid";
import styles from "./gantt.module.css";
import { TaskGanttContent, TaskGanttContentProps } from "./task-gantt-content";

export type TaskGanttProps = {
  gridProps: GridProps & {
    svgWidth: number;
    svgContainerWidth: number;
  };
  calendarProps: CalendarProps;
  barProps: TaskGanttContentProps;
  ganttHeight: number;
  scrollY: number;
  scrollX: number;
  setChartWrapperRef?: (ref: HTMLDivElement) => void;
};
export const TaskGantt: React.FC<TaskGanttProps> = ({
  gridProps,
  calendarProps,
  barProps,
  ganttHeight,
  scrollY,
  scrollX,
  setChartWrapperRef,
}) => {
  const ganttSVGRef = useRef<SVGSVGElement>(null);
  const horizontalContainerRef = useRef<HTMLDivElement>(null);
  const verticalGanttContainerRef = useRef<HTMLDivElement>(null);
  const newBarProps = { ...barProps, svg: ganttSVGRef };
  const [hoveredRowTaskId, setHoveredRowTaskId] = useState<string>();

  useEffect(() => {
    if (horizontalContainerRef.current) {
      horizontalContainerRef.current.scrollTop = scrollY;
    }
  }, [scrollY]);

  useEffect(() => {
    if (verticalGanttContainerRef.current) {
      verticalGanttContainerRef.current.scrollLeft = scrollX;
    }
  }, [scrollX]);

  useImperativeHandle(
    setChartWrapperRef,
    () => verticalGanttContainerRef.current as HTMLDivElement,
    [],
  );

  return (
    <div
      className={styles.ganttVerticalContainer}
      ref={verticalGanttContainerRef}
      onMouseLeave={() => setHoveredRowTaskId("")}
      dir="ltr"
    >
      <div
        ref={horizontalContainerRef}
        className={styles.horizontalContainer}
        style={
          ganttHeight
            ? { height: ganttHeight, width: gridProps.svgWidth }
            : { width: gridProps.svgWidth }
        }
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width={gridProps.svgWidth}
          height={
            barProps.rowHeight * barProps.tasks.length +
            calendarProps.headerHeight
          }
          fontFamily={barProps.fontFamily}
          ref={ganttSVGRef}
        >
          <Calendar {...calendarProps} />
          <Grid
            {...gridProps}
            taskHover={(id) => setHoveredRowTaskId(id)}
            headerHeight={calendarProps.headerHeight}
          />
          <TaskGanttContent
            {...newBarProps}
            hoveredRowTaskId={hoveredRowTaskId}
            headerHeight={calendarProps.headerHeight}
          />
        </svg>
      </div>
    </div>
  );
};
