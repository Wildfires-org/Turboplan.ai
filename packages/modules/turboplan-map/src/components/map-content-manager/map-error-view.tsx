import React from "react";

export function MapErrorView({ error }: { error: Error }) {
  return (
    <div className="w-full h-[400px] flex items-center justify-center bg-red-50 dark:bg-gray-900 rounded-lg border border-red-200 dark:border-red-800">
      <div className="text-center space-y-4">
        <div className="size-16 mx-auto mb-4 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
          <svg
            className="size-8 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            Error Loading Map Data
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {error.message || "Failed to fetch map layers"}
          </p>
        </div>
      </div>
    </div>
  );
}
