import React from "react";

import { AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react";

interface TasksErrorProps {
  error: string;
  onRetry?: () => void;
  onBack?: () => void;
}

export const TasksError: React.FC<TasksErrorProps> = ({
  error,
  onRetry,
  onBack,
}) => {
  return (
    <div className="w-full h-full min-h-[600px] flex flex-col items-center justify-center bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20">
      <div className="flex flex-col items-center space-y-8 text-center max-w-md mx-auto px-6">
        {/* Error Icon */}
        <div className="relative">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          {/* Pulsing effect */}
          <div className="absolute inset-0 w-16 h-16 bg-red-200 dark:bg-red-800/20 rounded-full animate-ping opacity-75"></div>
        </div>

        {/* Error Text */}
        <div className="space-y-2">
          <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
            Oops! Something went wrong
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">{error}</p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 w-full">
          {onRetry && (
            <button
              onClick={onRetry}
              className="flex items-center justify-center space-x-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors duration-200 font-medium"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Try Again</span>
            </button>
          )}

          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center justify-center space-x-2 px-6 py-3 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg transition-colors duration-200 font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Go Back</span>
            </button>
          )}
        </div>

        {/* Help Text */}
        <div className="text-xs text-gray-500 dark:text-gray-500 space-y-1 mt-8">
          <p>If this problem persists:</p>
          <div className="flex items-center justify-center space-y-1 flex-col">
            <span>• Check your internet connection</span>
            <span>• Refresh the page</span>
            <span>• Contact support if needed</span>
          </div>
        </div>
      </div>
    </div>
  );
};
