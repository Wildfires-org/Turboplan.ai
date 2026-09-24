import React, { ReactElement } from "react";

import { taskXCoordinate } from "../../helpers/bar-helper";
import { addToDate } from "../../helpers/date-helper";
import { Task } from "../../types/public-types";
import styles from "./grid.module.css";

export type GridBodyProps = {
  tasks: Task[];
  dates: Date[];
  svgWidth: number;
  rowHeight: number;
  columnWidth: number;
  todayColor: string;
  rtl: boolean;
  headerHeight: number;
  taskHover?: (id: string) => void;
};
export const GridBody: React.FC<GridBodyProps> = ({
  tasks,
  dates,
  rowHeight,
  svgWidth,
  columnWidth,
  todayColor,
  rtl,
  taskHover,
}) => {
  let y = 0;
  const gridRows: ReactElement[] = [];
  const rowLines: ReactElement[] = [
    <line
      key="RowLineFirst"
      x="0"
      y1={0}
      x2={svgWidth}
      y2={0}
      className={styles.gridRowLine}
    />,
  ];
  for (const task of tasks) {
    gridRows.push(
      <rect
        key={"Row" + task.id}
        x="0"
        y={y}
        onMouseEnter={() => {
          taskHover && taskHover(task.id);
        }}
        width={svgWidth}
        height={rowHeight}
        className={styles.gridRow}
        data-ishighlighted={task.isTrackHighlighted}
      />,
    );
    rowLines.push(
      <line
        key={"RowLine" + task.id}
        x="0"
        y1={y + rowHeight}
        x2={svgWidth}
        y2={y + rowHeight}
        className={styles.gridRowLine}
      />,
    );
    y += rowHeight;
  }

  const now = new Date();
  let tickX = 0;
  const ticks: ReactElement[] = [];
  let today: ReactElement = <rect />;
  for (let i = 0; i < dates.length; i++) {
    const date = dates[i];
    ticks.push(
      <line
        key={date.getTime()}
        x1={tickX}
        y1={0}
        x2={tickX}
        y2={y}
        className={styles.gridTick}
      />,
    );
    if (
      (i + 1 !== dates.length &&
        date.getTime() < now.getTime() &&
        dates[i + 1].getTime() >= now.getTime()) ||
      // if current date is last
      (i !== 0 &&
        i + 1 === dates.length &&
        date.getTime() < now.getTime() &&
        addToDate(
          date,
          date.getTime() - dates[i - 1].getTime(),
          "millisecond",
        ).getTime() >= now.getTime())
    ) {
      const positionXOfToday = taskXCoordinate(now, dates, columnWidth) - 4.8;
      today = (
        <g transform={`translate(${positionXOfToday}, 0)`}>
          <rect x={4.8} y={0} width={1} height={y} fill="#1B845C" />
          <path
            d="M6.47573 10.9678L9.28827 8.59935C9.73953 8.21934 10 7.65948 10 7.06953L10 6L0 6L0 7.00945C0 7.63364 0.291417 8.22203 0.787913 8.60032L3.97537 11.0289C4.72031 11.5964 5.75936 11.5711 6.47573 10.9678Z"
            fill="#1B845C"
          />
          <path
            d="M0 6L0 2C0 0.895431 0.89543 0 2 0L8 0C9.10457 0 10 0.895431 10 2L10 6L0 6Z"
            fill="#1B845C"
          />
        </g>
      );
    }
    // rtl for today
    if (
      rtl &&
      i + 1 !== dates.length &&
      date.getTime() >= now.getTime() &&
      dates[i + 1].getTime() < now.getTime()
    ) {
      today = (
        <rect
          x={tickX + columnWidth}
          y={0}
          width={columnWidth}
          height={y}
          fill={todayColor}
        />
      );
    }
    tickX += columnWidth;
  }
  return (
    <g className="gridBody">
      <g className="rows">{gridRows}</g>
      <g className={`${styles.rowLines} rowLines`}>{rowLines}</g>
      <g className={`${styles.gridTicks} ticks`}>{ticks}</g>
      <g className="today">{today}</g>
    </g>
  );
};
