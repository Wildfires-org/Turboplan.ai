import React, { useEffect, useRef, useState } from "react";

import {
  Check,
  Edit2,
  ExternalLink,
  MoreVertical,
  Network,
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

import { TaskStatus } from "../../types";
import { AssigneeDisplay } from "../assignee-display";
import { DeleteConfirmationModal } from "../delete-confirmation-modal";
import { COLUMN_WIDTHS, TABLE_CONFIG } from "./constants";
import { StatusButton } from "./status-button";
import type { TaskRowProps } from "./types";

export const TaskRow: React.FC<TaskRowProps> = ({
  task,
  isDragging,
  columnVisibility,
  taskColumnWidth,
  isReadOnly = false,
  onTaskClick,
  onTaskStatusClick,
  onAvatarClick,
  onManageDependencies,
  onOpenTask,
  onDeleteTask,
  onRenameTask,
  onDragStart,
  onDragEnd,
}) => {
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const inputRef = useRef<HTMLInputElement>(null);
  const editContainerRef = useRef<HTMLDivElement>(
    null,
  ) as React.RefObject<HTMLDivElement>;
  const isCompleted = task.status === TaskStatus.COMPLETED;

  const handleStartEdit = () => {
    setIsEditing(true);
    setEditTitle(task.title);
  };

  const handleSaveEdit = () => {
    if (editTitle.trim() && editTitle !== task.title) {
      onRenameTask?.(task.id, editTitle.trim());
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditTitle(task.title);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSaveEdit();
    } else if (e.key === "Escape") {
      handleCancelEdit();
    }
  };

  const handleDelete = () => {
    onDeleteTask?.(task.id);
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
    <div
      className={`group relative flex items-center border-t border-brandAlt-200/70 hover:bg-brandAlt-100 dark:border-white/10 dark:hover:bg-gray-800 ${
        isDragging ? "opacity-50" : ""
      } ${isEditing ? "overflow-visible" : "overflow-hidden"}`}
      style={{ height: `${TABLE_CONFIG.ROW_HEIGHT}px` }}
      draggable={!isEditing}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      {/* TASK Column */}
      <div
        className="px-4 py-2 pl-8 flex-shrink-0 overflow-hidden"
        style={{ width: `${taskColumnWidth}px` }}
      >
        <div className="flex items-center gap-2">
          {isCompleted && <Check className="size-4 shrink-0 text-brand-800" />}
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
              className={`cursor-pointer truncate text-sm hover:underline ${
                isCompleted
                  ? "text-gray-550 line-through decoration-gray-400"
                  : "text-gray-900 dark:text-gray-100"
              }`}
              data-task-title={task.id}
              onClick={() => onTaskClick?.(task.id)}
            >
              {task.title}
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
              assignees={task.assignees || []}
              size="sm"
              onClick={() => onAvatarClick?.(task.id)}
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
          {task.startDate ? new Date(task.startDate).toLocaleDateString() : "-"}
        </div>
      )}

      {/* DUE DATE Column */}
      {columnVisibility.dueDate && (
        <div
          className="flex-shrink-0 px-4 py-2 text-center text-[13px] tabular-nums text-gray-600 dark:text-gray-400"
          style={{ width: `${COLUMN_WIDTHS.DUE_DATE}px` }}
        >
          {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "-"}
        </div>
      )}

      {/* STATUS Column */}
      {columnVisibility.status && (
        <div
          className="px-4 py-2 text-center flex-shrink-0"
          style={{ width: `${COLUMN_WIDTHS.STATUS}px` }}
        >
          <div className="flex justify-center">
            <StatusButton
              status={task.status}
              onStatusChange={(status) => onTaskStatusClick?.(task.id, status)}
              isReadOnly={isReadOnly}
            />
          </div>
        </div>
      )}

      {/* Actions Column - Sticky Right (hidden in read-only mode) */}
      {!isReadOnly && (
        <div
          className="flex-shrink-0 bg-white py-2 group-hover:bg-brandAlt-100 dark:bg-gray-900 dark:group-hover:bg-gray-800"
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
                <button
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Task actions"
                  className="inline-flex size-8 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-white hover:text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700 data-[state=open]:bg-white dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={() => onOpenTask?.(task.id)}
                  className="flex items-center gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open Task
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleStartEdit}
                  className="flex items-center gap-2"
                >
                  <Edit2 className="h-4 w-4" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onManageDependencies?.(task.id)}
                  className="flex items-center gap-2"
                >
                  <Network className="h-4 w-4" />
                  Manage Dependencies
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    setIsDeleteModalOpen(true);
                  }}
                  className="flex items-center gap-2 text-error-700 focus:text-error-700 dark:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal - Outside dropdown to prevent conflicts */}
      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
        title="Delete Task"
        description=""
        itemName={task.title}
        itemType="task"
      />
    </div>
  );
};
