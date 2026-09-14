import { Skeleton } from "@wildfires-org/turboplan-utils";

/**
 * Loading skeleton for module sections
 */
export function ModuleSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="size-5" />
          <Skeleton className="h-6 w-24" />
        </div>
        <Skeleton className="h-8 w-20" />
      </div>
      <Skeleton className="h-[200px] w-full" />
    </div>
  );
}
