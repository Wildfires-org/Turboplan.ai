import React from "react";

import { COLUMNS } from "./constants";
import { type ColumnSettingsDropdownProps } from "./types";

export const ColumnSettingsDropdown: React.FC<ColumnSettingsDropdownProps> = ({
  columnVisibility,
  onToggleColumnVisibility,
  isVisible,
}) => {
  if (!isVisible) return null;

  return (
    <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-[200]">
      <div className="p-2">
        <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
          Show Columns
        </div>
        {COLUMNS.map((column) => (
          <label
            key={column.key}
            className="flex items-center gap-2 p-1 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer"
          >
            <input
              type="checkbox"
              checked={columnVisibility[column.key]}
              onChange={() => onToggleColumnVisibility(column.key)}
              className="rounded border-gray-300 dark:border-gray-600"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {column.label}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
};
