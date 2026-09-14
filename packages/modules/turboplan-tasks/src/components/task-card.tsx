import React from "react";

import { Calendar, ChevronDown } from "lucide-react";

import { cn } from "@wildfires-org/turboplan-utils";

import { type Task, TaskStatus } from "../types";
import { getStatusIcon, getStatusText } from "../utils";
import { AssigneeDisplay } from "./assignee-display";
import { StatusDropdown } from "./status-dropdown";

interface TaskCardProps {
  task: Task;
  onStatusChange?: (status: TaskStatus) => void;
  onTaskClick?: () => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onStatusChange,
  onTaskClick,
}) => {
  const isCompleted = task.status === TaskStatus.COMPLETED;

  return (
    <div
      className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
      onClick={onTaskClick}
    >
      <div className="space-y-3">
        <h4
          className={`font-medium text-gray-900 dark:text-gray-100 text-sm ${
            isCompleted ? "line-through text-gray-500 dark:text-gray-400" : ""
          }`}
        >
          {task.title}
        </h4>

        {/* Assignees */}
        {task.assignees && task.assignees.length > 0 && (
          <div className="flex items-center gap-2">
            <AssigneeDisplay
              assignees={task.assignees}
              size="sm"
              showNames={task.assignees.length <= 2}
            />
          </div>
        )}

        <div className="flex items-center justify-between">
          <StatusDropdown
            status={task.status}
            onStatusChange={(s) => onStatusChange?.(s)}
          >
            <button
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "px-3 py-1.5 text-xs rounded-md inline-flex items-center gap-1.5 font-medium transition-colors",
                task.status === TaskStatus.DRAFT
                  ? "bg-black hover:bg-gray-800 text-white"
                  : "bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300",
              )}
            >
              <span>{getStatusIcon(task.status)}</span>
              {getStatusText(task.status)}
              <ChevronDown className="h-3 w-3 opacity-70" />
            </button>
          </StatusDropdown>

          {task.dueDate && (
            <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
              <Calendar className="h-3 w-3 mr-1" />
              {new Date(task.dueDate).toLocaleDateString("en-US", {
                month: "2-digit",
                day: "2-digit",
                year: "2-digit",
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
