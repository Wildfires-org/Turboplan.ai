import { useCallback, useMemo, useState } from "react";

import { DEFAULT_COLUMN_VISIBILITY } from "../components/table/constants";
import {
  type ColumnKey,
  type ColumnVisibility,
} from "../components/table/types";

interface UseColumnVisibilityOptions {
  /** When true, hides the assignee column */
  isReadOnly?: boolean;
}

export const useColumnVisibility = (
  options: UseColumnVisibilityOptions = {},
) => {
  const { isReadOnly = false } = options;

  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibility>(
    DEFAULT_COLUMN_VISIBILITY,
  );

  // In read-only mode, hide the assignee column
  const effectiveColumnVisibility = useMemo<ColumnVisibility>(() => {
    if (isReadOnly) {
      return {
        ...columnVisibility,
        assignee: false,
      };
    }
    return columnVisibility;
  }, [columnVisibility, isReadOnly]);

  const toggleColumnVisibility = useCallback((column: ColumnKey) => {
    setColumnVisibility((prev) => ({
      ...prev,
      [column]: !prev[column],
    }));
  }, []);

  return {
    columnVisibility: effectiveColumnVisibility,
    toggleColumnVisibility,
  };
};
