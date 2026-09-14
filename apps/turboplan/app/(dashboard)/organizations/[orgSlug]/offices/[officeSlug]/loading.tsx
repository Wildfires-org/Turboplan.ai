import { Skeleton } from "@wildfires-org/turboplan-utils";

import { ProjectCardSkeleton } from "@/components/dashboard/project-card-skeleton";

export default function OfficeLoading() {
  return (
    <div className="flex flex-col shrink-0 min-h-screen">
      {/* DashboardHeader skeleton */}
      <header className="sticky top-0 z-30 flex shrink-0 h-16 items-center gap-4 border-b bg-background px-4 lg:px-6">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-24" />
          <span className="text-gray-400">/</span>
          <Skeleton className="h-4 w-28" />
        </div>
      </header>

      {/* EntityBanner skeleton */}
      <div className="relative w-full">
        <Skeleton className="h-[124px] w-full rounded-none" />
        <div className="absolute left-8 top-[88px] z-10">
          <Skeleton className="size-[72px] rounded-lg" />
        </div>
        <div className="border-b border-gray-300 bg-white px-8 pb-5 pt-[52px]">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-3 h-4 w-72" />
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 container mx-auto px-6">
        <div className="flex items-center gap-4 border-b py-4">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-20" />
        </div>
        <div className="py-6">
          <ProjectCardSkeleton count={6} />
        </div>
      </div>
    </div>
  );
}
