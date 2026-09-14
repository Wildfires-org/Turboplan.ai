import React, { useState } from "react";

import style from "./bar.module.css";

type BarDisplayProps = {
  x: number;
  y: number;
  width: number;
  height: number;
  isSelected: boolean;
  /* progress start point */
  progressX: number;
  progressWidth: number;
  barCornerRadius: number;
  styles: {
    backgroundColor: string;
    backgroundSelectedColor: string;
    progressColor: string;
    progressSelectedColor: string;
    border?: { width: number; color: string };
    diagonalHatchColor?: string;
  };
  onMouseDown: (event: React.MouseEvent<SVGPolygonElement, MouseEvent>) => void;
};
export const BarDisplay: React.FC<BarDisplayProps> = ({
  x,
  y,
  width,
  height,
  isSelected,
  progressX,
  progressWidth,
  barCornerRadius,
  styles,
  onMouseDown,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const getProcessColor = () => {
    return isSelected ? styles.progressSelectedColor : styles.progressColor;
  };

  const getBarColor = () => {
    return isSelected ? styles.backgroundSelectedColor : styles.backgroundColor;
  };

  const getBarBorderColor = () => {
    return isHovered ? styles.border?.color || "" : "";
  };

  const getBarBorderWidth = () => {
    return isHovered ? styles.border?.width || 0 : 0;
  };

  return (
    <g
      onMouseDown={onMouseDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <rect
        x={x}
        width={width}
        y={y}
        height={height}
        ry={barCornerRadius}
        rx={barCornerRadius}
        fill="transparent"
        strokeWidth={getBarBorderWidth()}
        stroke={getBarBorderColor()}
        className={style.barBackground}
      />
      <rect
        x={x}
        width={width}
        y={y}
        height={height}
        ry={barCornerRadius}
        rx={barCornerRadius}
        fill={getBarColor()}
        className={style.barBackground}
      />
      {styles.diagonalHatchColor && (
        <rect
          x={x}
          width={width}
          y={y}
          height={height}
          ry={barCornerRadius}
          rx={barCornerRadius}
          fill={`url(${styles.diagonalHatchColor})`}
        ></rect>
      )}
      <rect
        x={progressX}
        width={progressWidth || 8}
        y={y}
        height={height}
        ry={barCornerRadius}
        rx={barCornerRadius}
        fill={getProcessColor()}
      />
    </g>
  );
};
