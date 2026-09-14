import React from "react";

import { TasksLoadingAnimation } from "./tasks-loading-animation";

interface TasksLoaderProps {
  message?: string;
}

export const TasksLoader: React.FC<TasksLoaderProps> = ({
  message = "Loading your project tasks...",
}) => {
  return (
    <div className="w-full h-full min-h-[600px] flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="flex flex-col items-center space-y-8 text-center max-w-md mx-auto px-6">
        <TasksLoadingAnimation size="lg" message={message} />

        {/* Subtitle */}
        <p className="text-sm text-gray-600 dark:text-gray-400 -mt-2">
          Setting up your workspace...
        </p>

        {/* Feature List */}
        <div className="text-xs text-gray-500 dark:text-gray-500 space-y-1 mt-4">
          <div className="flex items-center justify-center space-x-2">
            <div className="w-1 h-1 bg-green-400 rounded-full"></div>
            <span>Loading milestones and tasks</span>
          </div>
          <div className="flex items-center justify-center space-x-2">
            <div className="w-1 h-1 bg-blue-400 rounded-full"></div>
            <span>Preparing Gantt timeline</span>
          </div>
          <div className="flex items-center justify-center space-x-2">
            <div className="w-1 h-1 bg-purple-400 rounded-full"></div>
            <span>Setting up collaboration tools</span>
          </div>
        </div>
      </div>
    </div>
  );
};
