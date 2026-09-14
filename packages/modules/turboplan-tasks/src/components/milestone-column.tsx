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
    <div className="flex-shrink-0 w-80 bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
            {milestone.title}
          </h3>
          <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
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
          className="w-full p-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-blue-600 dark:text-blue-400 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-sm font-medium transition-colors"
        >
          + Add Task
        </button>
      </div>
    </div>
  );
};
