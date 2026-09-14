import React from "react";

import styles from "./bar.module.css";

type BarProgressHandleProps = {
  progressPoint: string;
  dragHandleColor?: string;
  onMouseDown: (event: React.MouseEvent<SVGPolygonElement, MouseEvent>) => void;
};
export const BarProgressHandle: React.FC<BarProgressHandleProps> = ({
  dragHandleColor = "#ddd",
  progressPoint,
  onMouseDown,
}) => {
  return (
    <polygon
      className={styles.barHandle}
      points={progressPoint}
      onMouseDown={onMouseDown}
      fill={dragHandleColor}
    />
  );
};
