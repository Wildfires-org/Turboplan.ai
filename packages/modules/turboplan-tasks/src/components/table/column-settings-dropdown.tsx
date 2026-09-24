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
    <div className="absolute right-0 top-full z-[200] mt-1 w-48 rounded-xl border border-white/90 bg-white/[0.92] shadow-[0_18px_48px_-20px_rgba(15,23,42,0.28),inset_0_1px_0_rgba(255,255,255,0.95)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/[0.92]">
      <div className="p-2">
        <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
          Show Columns
        </div>
        {COLUMNS.map((column) => (
          <label
            key={column.key}
            className="flex cursor-pointer items-center gap-2 rounded-lg p-1 hover:bg-brandAlt-100 dark:hover:bg-white/10"
          >
            <input
              type="checkbox"
              checked={columnVisibility[column.key]}
              onChange={() => onToggleColumnVisibility(column.key)}
              className="rounded border-gray-300 accent-brand-800 dark:border-gray-600"
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
