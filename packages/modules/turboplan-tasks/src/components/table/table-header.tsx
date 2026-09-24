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
      className="relative flex flex-shrink-0 items-center bg-white dark:bg-gray-900"
      style={{ height: `${TABLE_CONFIG.HEADER_HEIGHT}px` }}
    >
      {/* TASK Column */}
      <div
        className="px-4 py-2 flex-shrink-0"
        style={{ width: `${taskColumnWidth}px` }}
      >
        <span className="text-left text-[11px] font-medium uppercase tracking-[0.08em] text-gray-550 dark:text-gray-400">
          TASK
        </span>
      </div>

      {/* ASSIGNEE Column */}
      {columnVisibility.assignee && (
        <div
          className="px-4 py-2 text-center flex-shrink-0"
          style={{ width: `${COLUMN_WIDTHS.ASSIGNEE}px` }}
        >
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-550 dark:text-gray-400">
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
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-550 dark:text-gray-400">
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
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-550 dark:text-gray-400">
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
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-550 dark:text-gray-400">
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
              type="button"
              aria-label="Column settings"
              aria-expanded={showColumnSettings}
              className="inline-flex size-7 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-brandAlt-100 hover:text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700 aria-expanded:bg-brandAlt-100 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
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
