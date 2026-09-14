import React from "react";

import { type MilestoneWithTasks, type TaskStatus } from "../types";
import { MilestoneColumn } from "./milestone-column";

interface CardViewProps {
  milestones: MilestoneWithTasks[];
  loading: boolean;
  error: string | null;
  onAddTask: (milestoneId: string) => void;
  onAddMilestone: () => void;
  onTaskStatusClick?: (taskId: string, status?: TaskStatus) => void;
  onTaskClick?: (taskId: string) => void;
}

export const CardView: React.FC<CardViewProps> = ({
  milestones,
  loading,
  error,
  onAddTask,
  onAddMilestone,
  onTaskStatusClick,
  onTaskClick,
}) => {
  if (loading) {
    return (
      <div className="p-6 flex gap-4 overflow-x-auto">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex-shrink-0 w-80 bg-gray-50 dark:bg-gray-900 rounded-lg p-4"
          >
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
              <div className="space-y-3">
                <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
                <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <div className="text-red-500 dark:text-red-400">
          Error loading milestones: {error}
        </div>
      </div>
    );
  }

  if (milestones.length === 0) {
    return (
      <div className="p-6 text-center">
        <div className="max-w-md mx-auto">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            No milestones yet
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Get started by creating your first milestone to organize your tasks.
          </p>
          <button
            onClick={onAddMilestone}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium"
          >
            Create Milestone
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex gap-6 overflow-x-auto pb-4">
        {milestones.map((milestone) => (
          <MilestoneColumn
            key={milestone.id}
            milestone={milestone}
            onAddTask={() => onAddTask(milestone.id)}
            onTaskStatusClick={onTaskStatusClick}
            onTaskClick={onTaskClick}
          />
        ))}

        {/* Add Milestone Column */}
        <div className="flex-shrink-0 w-80">
          <button
            onClick={onAddMilestone}
            className="w-full h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 dark:text-gray-400 hover:border-blue-400 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors flex flex-col items-center justify-center"
          >
            <div className="text-2xl mb-2">+</div>
            <div className="font-medium">Add Milestone</div>
          </button>
        </div>
      </div>
    </div>
  );
};
