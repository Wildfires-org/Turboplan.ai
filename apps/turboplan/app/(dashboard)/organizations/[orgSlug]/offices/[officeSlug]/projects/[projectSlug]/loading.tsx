import { Skeleton } from "@wildfires-org/turboplan-utils";

export default function ProjectLoading() {
  return (
    <div className="flex flex-col shrink-0 min-h-screen">
      {/* DashboardHeader skeleton */}
      <header className="sticky top-0 z-30 flex shrink-0 h-16 items-center gap-4 border-b bg-background px-4 lg:px-6">
        <nav className="flex items-center gap-2 text-sm">
          <Skeleton className="h-4 w-20" />
          <span className="text-gray-400">/</span>
          <Skeleton className="h-4 w-24" />
          <span className="text-gray-400">/</span>
          <Skeleton className="h-4 w-28" />
        </nav>
      </header>

      {/* Positioning context for the full-bleed cover (mirrors page.tsx). */}
      <div className="relative flex flex-1 flex-col">
        {/* Full-bleed cover background skeleton — matches ProjectImageHeader
            h-[450px] with the white gradient fading into #F9FAFB. */}
        <div className="absolute inset-x-0 top-0 z-0 h-[450px] w-full bg-muted">
          {/* eslint-disable-next-line tailwindcss/no-contradicting-classname */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-[#F9FAFB]/80 via-45% to-[#F9FAFB] to-70%" />
        </div>

        {/* Overlapping header card skeleton. */}
        <div className="relative z-10 container mx-auto px-6 pt-9">
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <div className="mt-6 flex items-start justify-between gap-4">
              <div className="flex min-w-0 flex-1 items-start gap-4">
                {/* Project avatar */}
                <Skeleton className="size-16 shrink-0 rounded-lg" />
                <div className="flex min-w-0 flex-1 flex-col">
                  {/* Title */}
                  <Skeleton className="h-8 w-64" />
                  {/* Description */}
                  <Skeleton className="mt-3 h-4 w-80" />
                  {/* Progress slot */}
                  <div className="mt-4 flex w-full items-center gap-16">
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5 pb-1">
                      <div className="flex w-full items-center justify-between">
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                      <Skeleton className="h-2 w-full rounded-sm" />
                    </div>
                    <Skeleton className="hidden h-3 w-40 shrink-0 sm:block" />
                  </div>
                  {/* Members + last-modified row */}
                  <div className="mt-5 flex items-center justify-between gap-4">
                    <div className="flex items-center -space-x-2">
                      <Skeleton className="size-8 rounded-full" />
                      <Skeleton className="size-8 rounded-full" />
                      <Skeleton className="size-8 rounded-full" />
                    </div>
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
              </div>
              {/* Right action cluster (Export + visibility eye) */}
              <div className="flex shrink-0 items-center gap-2">
                <Skeleton className="h-8 w-24" />
                <Skeleton className="size-8" />
              </div>
            </div>
          </div>
        </div>

        {/* Content modules skeleton */}
        <div className="relative z-10 flex-1 container mx-auto p-6 space-y-6">
          <div className="flex items-center justify-between pb-3">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-4 w-14" />
          </div>
          <Skeleton className="h-56 w-full rounded-xl" />
          <div className="flex items-center justify-between pb-3">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-4 w-14" />
          </div>
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
