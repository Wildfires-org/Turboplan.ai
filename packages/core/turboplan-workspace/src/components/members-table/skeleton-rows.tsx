"use client";

import { Skeleton } from "@wildfires-org/turboplan-utils";

interface SkeletonRowsProps {
  showSubEntityColumn: boolean;
  showActions: boolean;
}

export function SkeletonRows({
  showSubEntityColumn,
  showActions,
}: SkeletonRowsProps) {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 border-t border-gray-200 px-6 py-3"
        >
          <div className="flex-1 min-w-0 flex items-center gap-3">
            <Skeleton className="size-8 rounded-lg" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-44" />
            </div>
          </div>
          {showSubEntityColumn && (
            <div className="w-[200px] flex gap-1.5">
              <Skeleton className="h-5 w-20 rounded" />
              <Skeleton className="h-5 w-16 rounded" />
            </div>
          )}
          <div className="w-[120px]">
            <Skeleton className="h-9 w-[104px]" />
          </div>
          <div className="w-[100px]">
            <Skeleton className="size-4 rounded-full" />
          </div>
          {showActions && (
            <div className="w-[60px] flex justify-end">
              <Skeleton className="size-6 rounded-full" />
            </div>
          )}
        </div>
      ))}
    </>
  );
}
