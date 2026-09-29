import { ProjectCardSkeleton } from "@/components/dashboard/project-card-skeleton";

interface OfficeSkeletonProps {
  count?: number;
}

/** Office cards are EntityCards at their default 280px height. */
export function OfficeSkeleton({ count = 3 }: OfficeSkeletonProps) {
  return <ProjectCardSkeleton count={count} cardClassName="h-[280px]" />;
}
