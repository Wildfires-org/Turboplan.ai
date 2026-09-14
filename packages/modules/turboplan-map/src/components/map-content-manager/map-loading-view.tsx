import React from "react";

export function MapLoadingView() {
  return (
    <div className="w-full h-[400px] flex items-center justify-center bg-gray-50 dark:bg-gray-900 rounded-lg border">
      <div className="text-center space-y-4">
        <div className="size-16 mx-auto mb-4 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
          <div className="animate-spin rounded-full size-8 border-b-2 border-blue-500" />
        </div>
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            Loading Map Data
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Fetching geospatial layers...
          </p>
        </div>
      </div>
    </div>
  );
}
