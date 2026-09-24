import React from "react";

import { Calendar, ChevronDown } from "lucide-react";

import { cn } from "@wildfires-org/turboplan-utils";

import { type Task, TaskStatus } from "../types";
import { getStatusText } from "../utils";
import { AssigneeDisplay } from "./assignee-display";
import { getStatusTone, STATUS_CHIP_BASE_CLASS } from "./status-chip";
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
      className="mb-3 cursor-pointer rounded-xl border border-white/90 bg-white/80 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_10px_30px_-18px_rgba(15,23,42,0.22)] transition-colors hover:bg-white dark:border-gray-700 dark:bg-gray-800"
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
              type="button"
              onClick={(e) => e.stopPropagation()}
              className={cn(
                STATUS_CHIP_BASE_CLASS,
                getStatusTone(task.status).className,
                "transition-[filter] hover:brightness-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700",
              )}
            >
              <StatusToneIcon status={task.status} />
              {getStatusText(task.status)}
              <ChevronDown aria-hidden className="!size-3 opacity-70" />
            </button>
          </StatusDropdown>

          {task.dueDate && (
            <div className="flex items-center text-xs tabular-nums text-gray-600 dark:text-gray-400">
              <Calendar aria-hidden className="mr-1 size-3" />
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

const StatusToneIcon = ({ status }: { status: string }) => {
  const { icon: Icon } = getStatusTone(status);
  return <Icon aria-hidden />;
};
