import React, { useState } from "react";

import {
  useColumnVisibility,
  useTableResize,
  useTaskColumnWidth,
} from "../hooks";
import { ActionButton } from "./action-button";
import { COLUMN_WIDTHS } from "./table/constants";
import { MilestoneRow } from "./table/milestone-row";
import { ResizeHandle } from "./table/resize-handle";
import { TableHeader } from "./table/table-header";
import { type TasksTableProps } from "./table/types";

export const TasksTable: React.FC<TasksTableProps> = ({
  loading,
  error,
  milestones,
  expandedMilestones,
  isReadOnly = false,
  onToggleMilestone,
  onCreateTask,
  onTaskClick,
  onTaskStatusClick,
  onAvatarClick,
  onManageDependencies,
  onOpenTask,
  onDeleteTask,
  onCreateMilestone,
  onRenameMilestone,
  onRenameTask,
  onDeleteMilestone,
}) => {
  // Column visibility management
  const { columnVisibility, toggleColumnVisibility } = useColumnVisibility({
    isReadOnly,
  });

  // Safety check for milestones data
  const safeMilestones = Array.isArray(milestones) ? milestones : [];

  // Calculate optimal width for TASK column based on content
  const taskColumnWidth = useTaskColumnWidth({ milestones: safeMilestones });

  // Table resize management
  const { tableWidth, isResizing, tableRef, handleResizeStart } =
    useTableResize({
      taskColumnWidth,
      columnVisibility,
    });

  // Drag and drop state
  const [draggedMilestone, setDraggedMilestone] = useState<string | null>(null);

  const handleMilestoneDragStart = (milestoneId: string) => {
    setDraggedMilestone(milestoneId);
  };

  const handleMilestoneDragEnd = () => {
    setDraggedMilestone(null);
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-8">
          <div className="text-gray-500 dark:text-gray-400">
            Loading tasks...
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center py-8 text-red-500 dark:text-red-400">
          Error: {error}
        </div>
      );
    }

    // Safety check for taskColumnWidth
    if (!taskColumnWidth || taskColumnWidth <= 0) {
      return (
        <div className="flex items-center justify-center py-8">
          <div className="text-gray-500 dark:text-gray-400">
            Calculating layout...
          </div>
        </div>
      );
    }

    if (safeMilestones.length === 0) {
      return (
        <>
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No milestones found
          </div>
          {/* Add Milestone Row - hidden in read-only mode */}
          {!isReadOnly && (
            <div
              className="relative flex items-center border-t border-brandAlt-200/70 dark:border-gray-700 overflow-hidden"
              style={{ height: "52px" }}
            >
              {/* TASK Column */}
              <div
                className="px-4 py-2 flex-shrink-0"
                style={{ width: `${taskColumnWidth}px` }}
              >
                <ActionButton
                  label="Add Milestone"
                  onClick={() => onCreateMilestone?.()}
                />
              </div>

              {/* ASSIGNEE Column */}
              {columnVisibility.assignee && (
                <div
                  className="px-4 py-2 flex-shrink-0"
                  style={{ width: `${COLUMN_WIDTHS.ASSIGNEE}px` }}
                ></div>
              )}

              {/* START DATE Column */}
              {columnVisibility.startDate && (
                <div
                  className="px-4 py-2 flex-shrink-0"
                  style={{ width: `${COLUMN_WIDTHS.START_DATE}px` }}
                ></div>
              )}

              {/* DUE DATE Column */}
              {columnVisibility.dueDate && (
                <div
                  className="px-4 py-2 flex-shrink-0"
                  style={{ width: `${COLUMN_WIDTHS.DUE_DATE}px` }}
                ></div>
              )}

              {/* STATUS Column */}
              {columnVisibility.status && (
                <div
                  className="px-4 py-2 flex-shrink-0"
                  style={{ width: `${COLUMN_WIDTHS.STATUS}px` }}
                ></div>
              )}

              {/* Actions Column - Sticky Right */}
              <div
                className="py-2 bg-white dark:bg-gray-900 flex-shrink-0"
                style={{
                  width: `${COLUMN_WIDTHS.ACTIONS}px`,
                  position: "sticky",
                  right: 0,
                  zIndex: 20,
                }}
              ></div>
            </div>
          )}
        </>
      );
    }

    return (
      <>
        {safeMilestones.map((milestone) => (
          <MilestoneRow
            key={milestone.id}
            milestone={milestone}
            isExpanded={expandedMilestones[milestone.id] || false}
            isDragging={draggedMilestone === milestone.id}
            columnVisibility={columnVisibility}
            taskColumnWidth={taskColumnWidth}
            isReadOnly={isReadOnly}
            onToggleMilestone={onToggleMilestone}
            onCreateTask={onCreateTask}
            onTaskClick={onTaskClick}
            onTaskStatusClick={onTaskStatusClick}
            onAvatarClick={onAvatarClick}
            onManageDependencies={onManageDependencies}
            onOpenTask={onOpenTask}
            onDeleteTask={onDeleteTask}
            onRenameMilestone={onRenameMilestone}
            onRenameTask={onRenameTask}
            onDeleteMilestone={onDeleteMilestone}
            onDragStart={() => handleMilestoneDragStart(milestone.id)}
            onDragEnd={handleMilestoneDragEnd}
          />
        ))}

        {/* Add Milestone Row - hidden in read-only mode */}
        {!isReadOnly && (
          <div
            className="relative flex items-center border-t border-brandAlt-200/70 dark:border-gray-700 overflow-hidden"
            style={{ height: "52px" }}
          >
            {/* TASK Column */}
            <div
              className="px-4 py-2 flex-shrink-0"
              style={{ width: `${taskColumnWidth}px` }}
            >
              <ActionButton
                label="Add Milestone"
                onClick={() => onCreateMilestone?.()}
              />
            </div>

            {/* ASSIGNEE Column */}
            {columnVisibility.assignee && (
              <div
                className="px-4 py-2 flex-shrink-0"
                style={{ width: `${COLUMN_WIDTHS.ASSIGNEE}px` }}
              ></div>
            )}

            {/* START DATE Column */}
            {columnVisibility.startDate && (
              <div
                className="px-4 py-2 flex-shrink-0"
                style={{ width: `${COLUMN_WIDTHS.START_DATE}px` }}
              ></div>
            )}

            {/* DUE DATE Column */}
            {columnVisibility.dueDate && (
              <div
                className="px-4 py-2 flex-shrink-0"
                style={{ width: `${COLUMN_WIDTHS.DUE_DATE}px` }}
              ></div>
            )}

            {/* STATUS Column */}
            {columnVisibility.status && (
              <div
                className="px-4 py-2 flex-shrink-0"
                style={{ width: `${COLUMN_WIDTHS.STATUS}px` }}
              ></div>
            )}

            {/* Actions Column - Sticky Right */}
            <div
              className="py-2 bg-white dark:bg-gray-900 flex-shrink-0"
              style={{
                width: `${COLUMN_WIDTHS.ACTIONS}px`,
                position: "sticky",
                right: 0,
                zIndex: 20,
              }}
            ></div>
          </div>
        )}
      </>
    );
  };

  return (
    <div className="flex h-full">
      {/* Table Container */}
      <div
        ref={tableRef}
        className="relative z-10 flex h-full flex-col bg-white shadow-[50px_0_50px_-20px_rgba(15,23,42,0.05)] dark:bg-gray-900"
        style={{
          width: tableWidth,
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <TableHeader
          columnVisibility={columnVisibility}
          taskColumnWidth={taskColumnWidth}
          isReadOnly={isReadOnly}
          onToggleColumnVisibility={toggleColumnVisibility}
        />

        {/* Content */}
        <div className="flex-1 overflow-x-auto overflow-y-visible">
          {renderContent()}
        </div>
      </div>

      {/* Resize Handle */}
      <ResizeHandle isResizing={isResizing} onResizeStart={handleResizeStart} />
    </div>
  );
};
