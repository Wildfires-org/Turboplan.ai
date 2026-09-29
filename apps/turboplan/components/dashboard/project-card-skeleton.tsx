import { ENTITY_CARD_BODY_CLASS } from "@/components/dashboard/entity-card";
import { CHIP_BASE_CLASS, SKELETON_BAR_CLASS } from "@/lib/glass";
import { cn } from "@/lib/utils";

interface ProjectCardSkeletonProps {
  count?: number;
  /** Must match the real card's fixed height (EntityCard `className`). */
  cardClassName?: string;
}

/** Placeholder grid built from the same glass shell, grid and body box model
 * as EntityCard, so swapping in real cards doesn't move anything. */
export function ProjectCardSkeleton({
  count = 3,
  cardClassName = "h-[340px]",
}: ProjectCardSkeletonProps) {
  return (
    <div
      aria-busy="true"
      aria-label="Loading"
      className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
    >
      {Array.from({ length: count }, (_, i) => (
        <div
          key={`skeleton-${i}`}
          aria-hidden
          className={cn(
            "glass-card flex flex-col overflow-hidden",
            cardClassName,
          )}
        >
          <div className="flex min-h-0 flex-1 flex-col p-2 pb-0">
            <div
              className={cn(SKELETON_BAR_CLASS, "min-h-0 flex-1 rounded-xl")}
            />
          </div>

          <div className={ENTITY_CARD_BODY_CLASS}>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    CHIP_BASE_CLASS,
                    SKELETON_BAR_CLASS,
                    "w-16 rounded-full",
                  )}
                />
                <span
                  className={cn(
                    CHIP_BASE_CLASS,
                    SKELETON_BAR_CLASS,
                    "w-16 rounded-full",
                  )}
                />
              </div>
              <div className="flex h-[22px] items-center">
                <div className={cn(SKELETON_BAR_CLASS, "h-3.5 w-3/4")} />
              </div>
            </div>
            <div className="flex h-4 items-center gap-2">
              <div
                className={cn(SKELETON_BAR_CLASS, "h-1.5 flex-1 rounded-full")}
              />
              <div className={cn(SKELETON_BAR_CLASS, "h-3 w-7")} />
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  CHIP_BASE_CLASS,
                  SKELETON_BAR_CLASS,
                  "w-24 rounded-full",
                )}
              />
            </div>
            <div className="flex h-4 items-center">
              <div className={cn(SKELETON_BAR_CLASS, "h-3 w-20")} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
