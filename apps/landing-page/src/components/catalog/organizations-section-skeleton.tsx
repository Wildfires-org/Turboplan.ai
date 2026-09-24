import { cn } from "@/lib/utils";
import { CATALOG_GRID_CLASS, SKELETON_BAR_CLASS } from "./catalog-layout";

interface OrganizationsSectionSkeletonProps {
  className?: string;
}

export function OrganizationsSectionSkeleton({
  className,
}: OrganizationsSectionSkeletonProps) {
  return (
    <div
      role="list"
      aria-label="Loading organizations"
      aria-busy="true"
      className={cn(CATALOG_GRID_CLASS, "w-full", className)}
    >
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          role="listitem"
          className="glass-card flex items-center gap-4 p-5"
        >
          <div
            className={cn(SKELETON_BAR_CLASS, "size-12 shrink-0 rounded-xl")}
          />
          <div className="min-w-0 flex-1">
            <div className={cn(SKELETON_BAR_CLASS, "mb-2 h-4 w-3/4")} />
            <div className={cn(SKELETON_BAR_CLASS, "h-3 w-1/4")} />
          </div>
        </div>
      ))}
    </div>
  );
}
