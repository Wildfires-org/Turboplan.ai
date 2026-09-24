import React, { useEffect, useRef, useState } from "react";

import {
  Check,
  ChevronDown,
  ChevronRight,
  Edit2,
  MoreVertical,
  Trash2,
  X,
} from "lucide-react";
import { useOnClickOutside } from "usehooks-ts";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@wildfires-org/turboplan-utils";

import { ActionButton } from "../action-button";
import { AssigneeDisplay } from "../assignee-display";
import { DeleteConfirmationModal } from "../delete-confirmation-modal";
import { StatusChip } from "../status-chip";
import { COLUMN_WIDTHS, TABLE_CONFIG } from "./constants";
import { TaskRow } from "./task-row";
import type { MilestoneRowProps } from "./types";

export const MilestoneRow: React.FC<MilestoneRowProps> = ({
  milestone,
  isExpanded,
  isDragging,
  columnVisibility,
  taskColumnWidth,
  isReadOnly = false,
  onToggleMilestone,
  onCreateTask,
  onTaskClick,
  onTaskStatusClick,
  onAvatarClick,
  onManageDependencies,
  onOpenTask,
  onDeleteTask,
  onRenameMilestone,
  onRenameTask,
  onDeleteMilestone,
  onDragStart,
  onDragEnd,
}) => {
  const [draggedTask, setDraggedTask] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(milestone.title);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const editContainerRef = useRef<HTMLDivElement>(
    null,
  ) as React.RefObject<HTMLDivElement>;

  const handleTaskDragStart = (taskId: string) => {
    setDraggedTask(taskId);
  };

  const handleTaskDragEnd = () => {
    setDraggedTask(null);
  };

  const handleStartEdit = () => {
    setIsEditing(true);
    setEditTitle(milestone.title);
  };

  const handleSaveEdit = () => {
    if (editTitle.trim() && editTitle !== milestone.title) {
      onRenameMilestone?.(milestone.id, editTitle.trim());
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditTitle(milestone.title);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSaveEdit();
    } else if (e.key === "Escape") {
      handleCancelEdit();
    }
  };

  const handleDeleteMilestone = () => {
    onDeleteMilestone?.(milestone.id);
  };

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useOnClickOutside(editContainerRef, () => {
    if (isEditing) {
      handleCancelEdit();
    }
  });

  return (
    <React.Fragment>
      {/* Milestone Row */}
      <div
        className={`group relative flex items-center border-t border-brandAlt-200/70 bg-brandAlt-100 hover:bg-[#EDF5F1] dark:border-white/10 dark:bg-slate-900 dark:hover:bg-gray-800 ${
          isDragging ? "opacity-50" : ""
        } ${isEditing ? "overflow-visible" : "overflow-hidden"}`}
        style={{ height: `${TABLE_CONFIG.ROW_HEIGHT}px` }}
        draggable={!isEditing}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        {/* TASK Column */}
        <div
          className="px-4 py-2 flex-shrink-0"
          style={{ width: `${taskColumnWidth}px` }}
        >
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onToggleMilestone(milestone.id)}
              aria-expanded={isExpanded}
              aria-label={
                isExpanded ? "Collapse milestone" : "Expand milestone"
              }
              className="flex size-6 items-center justify-center rounded-md text-brand-800 transition-colors hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700 dark:text-brand-300 dark:hover:bg-gray-700"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
            {isEditing ? (
              <div ref={editContainerRef} className="flex-1 relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onKeyDown={handleKeyDown}
                  draggable={false}
                  className="w-full px-2 py-1 pr-14 text-sm rounded-md border border-transparent bg-white shadow-[inset_0_2px_6px_rgba(15,23,42,0.10),inset_0_1px_2px_rgba(15,23,42,0.08)] focus:outline focus:outline-2 focus:outline-brand-700/40 dark:bg-gray-800"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-1 gap-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      handleSaveEdit();
                    }}
                    className="rounded p-0.5 text-brand-800 hover:bg-brand-50 dark:hover:bg-green-900/20"
                    title="Save (Enter)"
                  >
                    <Check className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleCancelEdit();
                    }}
                    className="p-0.5 text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 rounded"
                    title="Cancel (Esc)"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ) : (
              <span
                className="flex min-w-0 items-center gap-2"
                data-milestone-title
              >
                <span className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {milestone.title}
                </span>
                <span className="inline-flex h-5 shrink-0 items-center rounded-full bg-white px-1.5 text-[11px] font-medium tabular-nums text-gray-600 ring-1 ring-inset ring-brandAlt-200">
                  {milestone.tasks?.length || 0}
                </span>
              </span>
            )}
          </div>
        </div>

        {/* ASSIGNEE Column */}
        {columnVisibility.assignee && (
          <div
            className="flex-shrink-0 px-4 py-2 text-center text-[13px] tabular-nums text-gray-600 dark:text-gray-400"
            style={{ width: `${COLUMN_WIDTHS.ASSIGNEE}px` }}
          >
            <div className="flex justify-center">
              <AssigneeDisplay
                assignees={milestone.assignees || []}
                size="sm"
                onClick={() => onAvatarClick?.(milestone.id)}
              />
            </div>
          </div>
        )}

        {/* START DATE Column */}
        {columnVisibility.startDate && (
          <div
            className="flex-shrink-0 px-4 py-2 text-center text-[13px] tabular-nums text-gray-600 dark:text-gray-400"
            style={{ width: `${COLUMN_WIDTHS.START_DATE}px` }}
          >
            {milestone.startDate
              ? new Date(milestone.startDate).toLocaleDateString()
              : "-"}
          </div>
        )}

        {/* DUE DATE Column */}
        {columnVisibility.dueDate && (
          <div
            className="flex-shrink-0 px-4 py-2 text-center text-[13px] tabular-nums text-gray-600 dark:text-gray-400"
            style={{ width: `${COLUMN_WIDTHS.DUE_DATE}px` }}
          >
            {milestone.dueDate
              ? new Date(milestone.dueDate).toLocaleDateString()
              : "-"}
          </div>
        )}

        {/* STATUS Column */}
        {columnVisibility.status && (
          <div
            className="px-4 py-2 text-center flex-shrink-0"
            style={{ width: `${COLUMN_WIDTHS.STATUS}px` }}
          >
            <div className="flex justify-center">
              <StatusChip status={milestone.status} />
            </div>
          </div>
        )}

        {/* Actions Column - Sticky Right (hidden in read-only mode) */}
        {!isReadOnly && (
          <div
            className="flex-shrink-0 bg-brandAlt-100 py-2 group-hover:bg-[#EDF5F1] dark:bg-slate-900 dark:group-hover:bg-gray-800"
            style={{
              width: `${COLUMN_WIDTHS.ACTIONS}px`,
              position: "sticky",
              right: 0,
              zIndex: 20,
            }}
          >
            <div className="flex justify-center">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="h-8 w-8 inline-flex items-center justify-center rounded-md text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800">
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleStartEdit}>
                    <Edit2 className="h-4 w-4 mr-2" />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onCreateTask?.(milestone.id)}
                  >
                    <span className="h-4 w-4 mr-2 flex items-center justify-center text-lg">
                      +
                    </span>
                    Add task
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setIsDeleteModalOpen(true)}
                    className="text-red-600 dark:text-red-400"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete milestone
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        )}
      </div>

      {/* Tasks */}
      {isExpanded &&
        milestone.tasks?.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            milestoneId={milestone.id}
            isDragging={draggedTask === task.id}
            columnVisibility={columnVisibility}
            taskColumnWidth={taskColumnWidth}
            isReadOnly={isReadOnly}
            onTaskClick={onTaskClick}
            onTaskStatusClick={onTaskStatusClick}
            onAvatarClick={onAvatarClick}
            onManageDependencies={onManageDependencies}
            onOpenTask={onOpenTask}
            onDeleteTask={onDeleteTask}
            onRenameTask={onRenameTask}
            onDragStart={() => handleTaskDragStart(task.id)}
            onDragEnd={handleTaskDragEnd}
          />
        ))}

      {/* Add Task Button - hidden in read-only mode */}
      {isExpanded && !isReadOnly && (
        <div
          className="relative flex items-center border-t border-brandAlt-200/70 dark:border-gray-700 overflow-hidden"
          style={{ height: `${TABLE_CONFIG.ROW_HEIGHT}px` }}
        >
          {/* TASK Column */}
          <div
            className="px-4 py-2 pl-8 flex-shrink-0"
            style={{ width: `${taskColumnWidth}px` }}
          >
            <ActionButton
              label="Add Task"
              onClick={() => onCreateTask(milestone.id)}
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

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteMilestone}
        title="Delete Milestone"
        description=""
        itemName={milestone.title}
        itemType="milestone"
      />
    </React.Fragment>
  );
};
