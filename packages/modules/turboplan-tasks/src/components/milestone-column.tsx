import React from "react";

import { CheckCircle2, Circle } from "lucide-react";

import { type MilestoneWithTasks, TaskStatus } from "../types";
import { TaskCard } from "./task-card";

interface MilestoneColumnProps {
  milestone: MilestoneWithTasks;
  onAddTask: () => void;
  onTaskStatusClick?: (taskId: string, status?: TaskStatus) => void;
  onTaskClick?: (taskId: string) => void;
}

export const MilestoneColumn: React.FC<MilestoneColumnProps> = ({
  milestone,
  onAddTask,
  onTaskStatusClick,
  onTaskClick,
}) => {
  const completedTasks =
    milestone.tasks?.filter((task) => task.status === TaskStatus.COMPLETED)
      .length || 0;
  const totalTasks = milestone.tasks?.length || 0;

  return (
    <div className="w-80 flex-shrink-0 rounded-2xl bg-brandAlt-100/80 p-4 ring-1 ring-inset ring-brandAlt-200/70 dark:bg-gray-900 dark:ring-white/10">
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
            {milestone.title}
          </h3>
          <div className="flex items-center text-xs tabular-nums text-gray-600 dark:text-gray-400">
            {completedTasks > 0 ? (
              <CheckCircle2 className="h-4 w-4 mr-1" />
            ) : (
              <Circle className="h-4 w-4 mr-1" />
            )}
            {completedTasks} / {totalTasks}
          </div>
        </div>
      </div>

      <div className="space-y-3 min-h-32">
        {milestone.tasks?.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onStatusChange={(status) => onTaskStatusClick?.(task.id, status)}
            onTaskClick={() => onTaskClick?.(task.id)}
          />
        ))}

        <button
          onClick={onAddTask}
          className="w-full rounded-xl border-2 border-dashed border-brand-800/20 p-3 text-sm font-medium text-brand-800 transition-colors hover:border-brand-800/40 hover:bg-white/60 dark:border-white/15 dark:text-brand-300 dark:hover:bg-white/5"
        >
          + Add Task
        </button>
      </div>
    </div>
  );
};
