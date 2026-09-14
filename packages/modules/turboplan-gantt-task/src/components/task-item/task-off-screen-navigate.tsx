import React from "react";

import { humanReadableDate } from "../../helpers/other-helper";
import { BarTask } from "../../types/bar-task";
import style from "./task-list.module.css";

export const TaskOffScreenNavigate = ({
  stickyPosition,
  containerWidth,
  scrollX,
  task,
  onOffscreenTaskNavigate,
}: {
  task: BarTask;
  scrollX: number;
  containerWidth: number;
  onOffscreenTaskNavigate: (task: BarTask) => void;
  stickyPosition: "left" | "right";
}) => (
  <svg
    className={style.pointer}
    x={
      stickyPosition === "right" ? scrollX + containerWidth - 120 : scrollX + 20
    }
    y={task.y}
    height="23"
    onClick={() => onOffscreenTaskNavigate(task)}
    width="84"
    viewBox="0 0 84 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    {stickyPosition === "left" && (
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M13.7652 8.73483C13.9116 8.58839 14.1491 8.58839 14.2955 8.73483C14.442 8.88128 14.442 9.11872 14.2955 9.26517L11.9357 11.625H18.0303C18.2374 11.625 18.4053 11.7929 18.4053 12C18.4053 12.2071 18.2374 12.375 18.0303 12.375H11.9357L14.2955 14.7348C14.442 14.8813 14.442 15.1187 14.2955 15.2652C14.1491 15.4116 13.9116 15.4116 13.7652 15.2652L10.7652 12.2652C10.6187 12.1187 10.6187 11.8813 10.7652 11.7348L13.7652 8.73483Z"
        fill="#505358"
      />
    )}
    <text
      x={stickyPosition === "right" ? "12" : "24"}
      y="16"
      fill="#505358"
      fontSize="11"
      fontFamily="system-ui, -apple-system, sans-serif"
    >
      {humanReadableDate(task.start)}
    </text>
    {stickyPosition === "right" && (
      <path
        className={style.pointer}
        fillRule="evenodd"
        clipRule="evenodd"
        d="M70.2348 8.73483C70.3813 8.58839 70.6187 8.58839 70.7652 8.73483L73.7652 11.7348C73.9116 11.8813 73.9116 12.1187 73.7652 12.2652L70.7652 15.2652C70.6187 15.4116 70.3813 15.4116 70.2348 15.2652C70.0884 15.1187 70.0884 14.8813 70.2348 14.7348L72.5947 12.375H66.5C66.2929 12.375 66.125 12.2071 66.125 12C66.125 11.7929 66.2929 11.625 66.5 11.625H72.5947L70.2348 9.26517C70.0884 9.11872 70.0884 8.88128 70.2348 8.73483Z"
        fill="#505358"
      />
    )}
    <rect x="0.5" y="0.5" width="83" height="23" rx="3.5" stroke="#DADBE0" />
  </svg>
);
