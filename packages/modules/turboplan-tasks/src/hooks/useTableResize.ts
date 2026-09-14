import { useCallback, useEffect, useRef, useState } from "react";

import { COLUMN_WIDTHS, TABLE_CONFIG } from "../components/table/constants";
import { type ColumnVisibility } from "../components/table/types";

interface UseTableResizeProps {
  taskColumnWidth: number;
  columnVisibility: ColumnVisibility;
}

export const useTableResize = ({
  taskColumnWidth,
  columnVisibility,
}: UseTableResizeProps) => {
  const [tableWidth, setTableWidth] = useState(0);
  const [isResizing, setIsResizing] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);

  // Calculate total width based on visible columns
  const getVisibleColumnsWidth = useCallback(() => {
    let width = taskColumnWidth + COLUMN_WIDTHS.ACTIONS; // TASK and ACTIONS always visible
    if (columnVisibility.assignee) width += COLUMN_WIDTHS.ASSIGNEE;
    if (columnVisibility.startDate) width += COLUMN_WIDTHS.START_DATE;
    if (columnVisibility.dueDate) width += COLUMN_WIDTHS.DUE_DATE;
    if (columnVisibility.status) width += COLUMN_WIDTHS.STATUS;
    return width;
  }, [taskColumnWidth, columnVisibility]);

  const totalFixedWidth = getVisibleColumnsWidth();
  const minTableWidth =
    taskColumnWidth + COLUMN_WIDTHS.ACTIONS + TABLE_CONFIG.MIN_PADDING;

  // Update table width when dependencies change
  useEffect(() => {
    const newTotalWidth = getVisibleColumnsWidth();
    setTableWidth(newTotalWidth);
  }, [getVisibleColumnsWidth]);

  // Handle resize logic
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizing && tableRef.current) {
        const rect = tableRef.current.getBoundingClientRect();
        const newWidth = e.clientX - rect.left;
        const constrainedWidth = Math.min(
          Math.max(minTableWidth, newWidth),
          totalFixedWidth,
        );
        setTableWidth(constrainedWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, minTableWidth, totalFixedWidth]);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  return {
    tableWidth,
    isResizing,
    tableRef,
    handleResizeStart,
    minTableWidth,
    totalFixedWidth,
  };
};
