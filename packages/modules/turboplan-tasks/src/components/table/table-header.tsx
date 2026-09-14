import React, { useRef, useState } from "react";

import { Settings } from "lucide-react";
import { useOnClickOutside } from "usehooks-ts";

import { ColumnSettingsDropdown } from "./column-settings-dropdown";
import { COLUMN_WIDTHS, TABLE_CONFIG } from "./constants";
import { type TableHeaderProps } from "./types";

export const TableHeader: React.FC<TableHeaderProps> = ({
  columnVisibility,
  taskColumnWidth,
  isReadOnly = false,
  onToggleColumnVisibility,
}) => {
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(
    null,
  ) as React.RefObject<HTMLDivElement>;

  // Close column settings dropdown when clicking outside
  useOnClickOutside(settingsRef, () => {
    if (showColumnSettings) {
      setShowColumnSettings(false);
    }
  });

  return (
    <div
      className="relative flex items-center bg-white dark:bg-gray-900 flex-shrink-0"
      style={{ height: `${TABLE_CONFIG.HEADER_HEIGHT}px` }}
    >
      {/* TASK Column */}
      <div
        className="px-4 py-2 flex-shrink-0"
        style={{ width: `${taskColumnWidth}px` }}
      >
        <span className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          TASK
        </span>
      </div>

      {/* ASSIGNEE Column */}
      {columnVisibility.assignee && (
        <div
          className="px-4 py-2 text-center flex-shrink-0"
          style={{ width: `${COLUMN_WIDTHS.ASSIGNEE}px` }}
        >
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            ASSIGNEE
          </span>
        </div>
      )}

      {/* START DATE Column */}
      {columnVisibility.startDate && (
        <div
          className="px-4 py-2 text-center flex-shrink-0"
          style={{ width: `${COLUMN_WIDTHS.START_DATE}px` }}
        >
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            START DATE
          </span>
        </div>
      )}

      {/* DUE DATE Column */}
      {columnVisibility.dueDate && (
        <div
          className="px-4 py-2 text-center flex-shrink-0"
          style={{ width: `${COLUMN_WIDTHS.DUE_DATE}px` }}
        >
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            DUE DATE
          </span>
        </div>
      )}

      {/* STATUS Column */}
      {columnVisibility.status && (
        <div
          className="px-4 py-2 text-center flex-shrink-0"
          style={{ width: `${COLUMN_WIDTHS.STATUS}px` }}
        >
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            STATUS
          </span>
        </div>
      )}

      {/* Actions Column - Sticky Right (hidden in read-only mode) */}
      {!isReadOnly && (
        <div
          className="py-2 flex-shrink-0 relative bg-white dark:bg-gray-900"
          style={{
            width: `${COLUMN_WIDTHS.ACTIONS}px`,
            position: "sticky",
            right: 0,
            zIndex: 30,
          }}
          ref={settingsRef}
        >
          <div className="flex justify-center">
            <button
              onClick={() => setShowColumnSettings(!showColumnSettings)}
              className="h-6 w-6 inline-flex items-center justify-center rounded text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700"
              title="Column settings"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>
          <ColumnSettingsDropdown
            columnVisibility={columnVisibility}
            onToggleColumnVisibility={onToggleColumnVisibility}
            isVisible={showColumnSettings}
          />
        </div>
      )}
    </div>
  );
};
