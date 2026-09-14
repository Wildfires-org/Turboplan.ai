import React from "react";

import { getProgressPoint } from "../../../helpers/bar-helper";
import { TaskItemProps } from "../task-item";
import styles from "./bar.module.css";
import { BarDateHandle } from "./bar-date-handle";
import { BarDisplay } from "./bar-display";
import { BarProgressHandle } from "./bar-progress-handle";

export const BarSmall: React.FC<TaskItemProps> = ({
  task,
  isProgressChangeable,
  isDateChangeable,
  onEventStart,
  isSelected,
}) => {
  const progressPoint = getProgressPoint(
    task.progressWidth + task.x1,
    task.y,
    task.height,
  );
  const handleHeight = task.height - 2;
  return (
    <g tabIndex={0} className={styles.barSmallBarHandle}>
      <BarDisplay
        x={task.x1}
        y={task.y}
        width={task.x2 - task.x1}
        height={task.height}
        progressX={task.progressX}
        progressWidth={task.progressWidth}
        barCornerRadius={task.barCornerRadius}
        styles={task.styles}
        isSelected={isSelected}
        onMouseDown={(e) => {
          isDateChangeable && onEventStart("move", task, e);
        }}
      />
      <g className={`${styles.handleGroup} handleGroup`}>
        {isDateChangeable && (
          <g>
            {/* left */}
            <BarDateHandle
              x={task.x1 - (task.handleWidth + 2)}
              y={task.y + 1}
              width={task.handleWidth}
              height={handleHeight}
              barCornerRadius={task.barCornerRadius}
              barColor={task?.styles?.dragHandleColor}
              onMouseDown={(e) => {
                onEventStart("start", task, e);
              }}
            />
            {/* right */}
            <BarDateHandle
              x={task.x2 + 2}
              y={task.y + 1}
              width={task.handleWidth}
              height={handleHeight}
              barCornerRadius={task.barCornerRadius}
              barColor={task?.styles?.dragHandleColor}
              onMouseDown={(e) => {
                onEventStart("end", task, e);
              }}
            />
          </g>
        )}

        {isProgressChangeable && (
          <BarProgressHandle
            dragHandleColor={task?.styles?.dragHandleColor}
            progressPoint={progressPoint}
            onMouseDown={(e) => {
              onEventStart("progress", task, e);
            }}
          />
        )}
      </g>
    </g>
  );
};
