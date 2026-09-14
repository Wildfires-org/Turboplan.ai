import React from "react";

import { cn } from "@wildfires-org/turboplan-utils";

interface StateContainerProps {
  className?: string;
  children: React.ReactNode;
}

function StateContainer({ className, children }: StateContainerProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center bg-gradient-to-br rounded-lg border w-full",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function LoadingState({ className }: { className?: string }) {
  return (
    <StateContainer
      className={cn(
        "from-blue-50 to-green-50 dark:from-gray-900 dark:to-gray-800",
        className,
      )}
    >
      <div className="text-center space-y-4">
        <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            Loading Map
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Initializing map components...
          </p>
        </div>
      </div>
    </StateContainer>
  );
}

export function ErrorState({
  className,
  message,
}: {
  className?: string;
  message: string;
}) {
  return (
    <StateContainer
      className={cn(
        "from-red-50 to-orange-50 dark:from-gray-900 dark:to-gray-800",
        className,
      )}
    >
      <div className="text-center space-y-4">
        <div className="w-16 h-16 mx-auto mb-4 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
          <svg
            className="w-8 h-8 text-red-500"
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
            Map Loading Error
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">{message}</p>
        </div>
      </div>
    </StateContainer>
  );
}

export function EmptyState({
  className,
  title,
  message,
}: {
  className?: string;
  title?: string;
  message: string;
}) {
  return (
    <StateContainer
      className={cn(
        "from-blue-50 to-green-50 dark:from-gray-900 dark:to-gray-800",
        className,
      )}
    >
      <div className="text-center space-y-4">
        <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
          <svg
            className="w-8 h-8 text-blue-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
            />
          </svg>
        </div>
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            {title || "No Map Data"}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">{message}</p>
        </div>
      </div>
    </StateContainer>
  );
}
