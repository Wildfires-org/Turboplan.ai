import React from "react";

import { type ResizeHandleProps } from "./types";

export const ResizeHandle: React.FC<ResizeHandleProps> = ({
  isResizing,
  onResizeStart,
}) => {
  return (
    <div
      className="relative w-1 cursor-col-resize group transition-colors hover:bg-brand-700"
      onMouseDown={onResizeStart}
    >
      <div className="absolute inset-0 w-3 -ml-1 bg-transparent group-hover:bg-brand-700/15" />
      {isResizing && (
        <div className="absolute inset-0 w-1 bg-brand-700 shadow-lg" />
      )}
    </div>
  );
};
