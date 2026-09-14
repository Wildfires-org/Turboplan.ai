import React, { useCallback, useEffect, useMemo, useRef } from "react";

import { BarTask } from "../../types/bar-task";
import { GanttContentMoveAction } from "../../types/gantt-task-actions";
import { Bar } from "./bar/bar";
import { BarSmall } from "./bar/bar-small";
import { Diamond } from "./diamond/diamond";
import { Milestone } from "./milestone/milestone";
import { Project } from "./project/project";
import style from "./task-list.module.css";
import { TaskOffScreenNavigate } from "./task-off-screen-navigate";

export type TaskItemProps = {
  task: BarTask;
  arrowIndent: number;
  taskHeight: number;
  isProgressChangeable: boolean;
  isDateChangeable: boolean;
  isDelete: boolean;
  isSelected: boolean;
  rtl: boolean;
  scrollX?: number;
  hoveredRowTaskId?: string;
  containerWidth: number;
  onOffscreenTaskNavigate: (task: BarTask) => void;
  onEventStart: (
    action: GanttContentMoveAction,
    selectedTask: BarTask,
    event?: React.MouseEvent | React.KeyboardEvent,
  ) => void;
};

export const TaskItem: React.FC<TaskItemProps> = (props) => {
  const {
    task,
    arrowIndent,
    isDelete,
    taskHeight,
    isSelected,
    rtl,
    containerWidth,
    hoveredRowTaskId,
    scrollX = 0,
    onEventStart,
    onOffscreenTaskNavigate,
  } = {
    ...props,
  };
  const textRef = useRef<SVGTextElement>(null);
  const taskBarRef = useRef<SVGGElement>(null);
  const stickyPosition = useRef<null | "left" | "right">(null);
  const taskStart = task.x1;
  const taskEnd = task.x2;
  const scrollXRef = useRef<number>(0);
  const taskStartRef = useRef<number>(0);
  scrollXRef.current = scrollX;
  taskStartRef.current = taskStart;

  const onVisibilityChange = useCallback((isVisible: boolean) => {
    const roundedStart = Math.round(taskStartRef.current);
    if (isVisible) {
      stickyPosition.current = null;
    } else {
      if (roundedStart > scrollXRef.current) {
        stickyPosition.current = "right";
      }

      if (roundedStart < scrollXRef.current) {
        stickyPosition.current = "left";
      }
    }
  }, []);

  useEffect(() => {
    if (taskBarRef.current) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => onVisibilityChange(entry.isIntersecting));
      });

      observer.observe(taskBarRef.current);
    }
  }, []);

  const taskItem = useMemo(() => {
    switch (task.typeInternal) {
      case "milestone":
        return <Milestone {...props} />;
      case "project":
        return <Project {...props} />;
      case "smalltask":
        return <BarSmall {...props} />;
      case "diamond":
        return <Diamond {...props} />;
      case "empty":
        return null;
      default:
        return <Bar {...props} />;
    }
  }, [task, isSelected]);

  const isTextInside = useMemo(() => {
    if (textRef.current) {
      return textRef.current.getBBox().width < taskEnd - taskStart;
    }
    return false;
  }, [textRef, task]);

  const getTextFill = () => {
    const textStyles = task.styles?.text || {};
    const { colorInsideBar = "#fff", colorOutsideBar = "#555" } = textStyles;
    return isTextInside ? colorInsideBar : colorOutsideBar;
  };

  const getX = () => {
    const width = taskEnd - taskStart;
    const hasChild = task.barChildren.length > 0;
    const getDefaultX = () =>
      taskStart + width + arrowIndent * +hasChild + arrowIndent * 0.2;

    if (task.typeInternal === "diamond") {
      const paddingLeft = 10;
      return getDefaultX() + task.height + paddingLeft;
    }

    if (task.typeInternal === "smalltask") {
      return getDefaultX() + task.handleWidth;
    }
    if (isTextInside) {
      const textWidth = textRef?.current?.getBBox().width || 1;
      const paddingLeft = 16;
      return taskStart + textWidth / 2 + paddingLeft;
    }
    if (rtl && textRef.current) {
      return (
        taskStart -
        textRef.current.getBBox().width -
        arrowIndent * +hasChild -
        arrowIndent * 0.2
      );
    } else {
      return getDefaultX();
    }
  };

  return task.typeInternal === "empty" ? null : (
    <g>
      {stickyPosition.current && hoveredRowTaskId === task.id && (
        <TaskOffScreenNavigate
          task={task}
          onOffscreenTaskNavigate={onOffscreenTaskNavigate}
          stickyPosition={stickyPosition.current}
          containerWidth={containerWidth}
          scrollX={scrollX}
        />
      )}
      <g
        ref={taskBarRef}
        data-testid={`gantt-${task.name}`}
        onKeyDown={(e) => {
          switch (e.key) {
            case "Delete": {
              if (isDelete) onEventStart("delete", task, e);
              break;
            }
          }
          e.stopPropagation();
        }}
        onMouseEnter={(e) => {
          onEventStart("mouseenter", task, e);
        }}
        onMouseLeave={(e) => {
          onEventStart("mouseleave", task, e);
        }}
        onDoubleClick={(e) => {
          onEventStart("dblclick", task, e);
        }}
        onClick={(e) => {
          onEventStart("click", task, e);
        }}
        onFocus={() => {
          onEventStart("select", task);
        }}
      >
        {task.styles.diagonalHatchColor && (
          <defs>
            <pattern
              id={`${task.styles.diagonalHatchColor.replace("#", "")}`}
              patternUnits="userSpaceOnUse"
              width="4"
              height="12"
              patternTransform="rotate(55 2 2)"
            >
              <path
                d="M -1,2 l 6,0"
                stroke={task.styles.diagonalHatchColor}
                fillOpacity={0}
                strokeOpacity={0.1}
                strokeWidth={1.5}
              />
            </pattern>
          </defs>
        )}

        {taskItem}
        <text
          x={getX()}
          y={task.y + taskHeight * 0.5}
          className={
            isTextInside
              ? style.barLabel
              : style.barLabel && style.barLabelOutside
          }
          fill={getTextFill()}
          ref={textRef}
        >
          {task.name}
        </text>
      </g>
    </g>
  );
};
