import { cn } from "@/lib/utils";
import { OrganizationsSectionHeader } from "./organizations-section-header";

interface OrganizationsSectionSkeletonProps {
  className?: string;
}

export function OrganizationsSectionSkeleton({
  className,
}: OrganizationsSectionSkeletonProps) {
  return (
    <section
      className={cn(
        "bg-white/95 p-6 md:p-12 drop-shadow mt-6 w-full max-w-[1080px] mx-auto rounded-t-3xl",
        className,
      )}
    >
      <OrganizationsSectionHeader />

      <div
        role="list"
        aria-label="Loading agencies"
        className="rounded-3xl bg-white grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 overflow-hidden mt-10 min-h-[445px] md:min-h-[267px]"
      >
        {[...Array(9)].map((_, i) => (
          <div
            key={i}
            role="listitem"
            className="flex items-center gap-4 p-5 border-b border-r border-neutral-grey animate-pulse"
          >
            <div className="w-12 h-12 bg-gray-200 rounded shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
              <div className="h-3 bg-gray-200 rounded w-1/4" />
            </div>
          </div>
        ))}
      </div>

      {/* Pagination placeholder */}
      <div className="flex items-center justify-center pt-8 h-[72px]">
        <div className="flex items-center gap-2 animate-pulse">
          <div className="w-8 h-8 bg-gray-200 rounded-full" />
          <div className="w-8 h-8 bg-gray-200 rounded-full" />
          <div className="w-8 h-8 bg-gray-200 rounded-full" />
          <div className="w-8 h-8 bg-gray-200 rounded-full" />
        </div>
      </div>
    </section>
  );
}
