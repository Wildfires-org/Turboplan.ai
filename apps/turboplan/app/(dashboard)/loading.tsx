import { Skeleton } from "@wildfires-org/turboplan-utils";

export default function DashboardLoading() {
  return (
    <div className="flex flex-col shrink-0 min-h-screen">
      {/* DashboardHeader skeleton */}
      <header className="sticky top-0 z-30 flex shrink-0 h-16 items-center gap-4 border-b bg-background px-4 lg:px-6">
        <Skeleton className="h-4 w-32" />
      </header>

      <div className="flex-1 flex items-center justify-center">
        <div className="size-8 animate-spin rounded-full border-2 border-muted border-t-foreground" />
      </div>
    </div>
  );
}
