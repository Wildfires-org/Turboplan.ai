import { cn } from "@/lib/utils";
import { CATALOG_GRID_CLASS, SKELETON_BAR_CLASS } from "./catalog-layout";

interface CatalogCardSkeletonGridProps {
  count?: number;
  label: string;
}

// Loading state matching ProjectCard / TemplateCard: media, meta, title,
// action.
export function CatalogCardSkeletonGrid({
  count = 3,
  label,
}: CatalogCardSkeletonGridProps) {
  return (
    <div
      role="list"
      aria-label={label}
      aria-busy="true"
      className={CATALOG_GRID_CLASS}
    >
      {[...Array(count)].map((_, i) => (
        <div
          key={i}
          role="listitem"
          className="glass-card flex flex-col overflow-hidden rounded-2xl"
        >
          <div className="p-2 pb-0">
            <div
              className={cn(SKELETON_BAR_CLASS, "aspect-video rounded-xl")}
            />
          </div>
          <div className="flex flex-1 flex-col p-5 sm:p-6">
            <div
              className={cn(SKELETON_BAR_CLASS, "mb-4 h-5 w-24 rounded-full")}
            />
            <div className={cn(SKELETON_BAR_CLASS, "mb-2 h-3 w-1/2")} />
            <div className={cn(SKELETON_BAR_CLASS, "mb-5 h-4 w-3/4")} />
            <div className={cn(SKELETON_BAR_CLASS, "h-10 w-full rounded-xl")} />
          </div>
        </div>
      ))}
    </div>
  );
}
