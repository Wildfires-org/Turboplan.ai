import React from "react";

import { type ResizeHandleProps } from "./types";

export const ResizeHandle: React.FC<ResizeHandleProps> = ({
  isResizing,
  onResizeStart,
}) => {
  return (
    <div
      className="relative w-1 cursor-col-resize group hover:bg-orange-500 transition-colors"
      onMouseDown={onResizeStart}
    >
      <div className="absolute inset-0 w-3 -ml-1 bg-transparent group-hover:bg-orange-500/20" />
      {isResizing && (
        <div className="absolute inset-0 w-1 bg-orange-500 shadow-lg" />
      )}
    </div>
  );
};
