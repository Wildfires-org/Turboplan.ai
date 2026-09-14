import { ImageIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PublicProject } from "@/types/public-project";
import { routing } from "@/utils/routing";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

interface ProjectCardProps {
  project: PublicProject;
  className?: string;
}

export function ProjectCard({ project, className }: ProjectCardProps) {
  const { milestoneProgress, organization, office, endDate } = project;

  const isCompleted =
    milestoneProgress != null &&
    milestoneProgress.completedSteps === milestoneProgress.totalSteps;

  const progressPercent = milestoneProgress
    ? (milestoneProgress.completedSteps / milestoneProgress.totalSteps) * 100
    : 0;

  // Build project detail URL using slugs
  const projectUrl = routing.catalogProject({
    organizationSlug: organization.slug,
    officeSlug: office.slug,
    projectSlug: project.slug,
  });

  return (
    <Link
      href={projectUrl}
      className={cn(
        "bg-white rounded-xl border border-neutral-grey overflow-hidden hover:shadow-md transition-shadow block",
        className,
      )}
    >
      <div
        className="aspect-video bg-gray-150 relative"
        style={{
          maskImage: "linear-gradient(to bottom, black 80%, transparent)",
          WebkitMaskImage: "linear-gradient(to bottom, black 80%, transparent)",
        }}
      >
        {project.coverImageUrl ? (
          <Image
            src={project.coverImageUrl}
            alt={project.name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <ImageIcon className="size-8 text-neutral-grey3/40" />
          </div>
        )}
      </div>

      <div className="p-6 pt-4">
        <div className="flex items-start justify-between mb-3">
          <Badge
            variant="lightGray"
            className="text-[10px] uppercase rounded-full px-3"
          >
            {isCompleted ? "Completed" : "In Progress"}
          </Badge>
          {organization.logoUrl ? (
            <Image
              src={organization.logoUrl}
              alt={organization.name}
              width={32}
              height={32}
              className="w-8 h-8 rounded object-contain"
            />
          ) : (
            <div className="w-8 h-8 rounded bg-gray-150 flex items-center justify-center text-xs text-neutral-grey3">
              {organization.name.slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>

        <p className="text-xs text-neutral-grey3 mb-1">
          {organization.name} / {office.name}
        </p>
        <h3 className="text-sm font-medium text-neutral-black mb-3 line-clamp-2">
          {project.name}
        </h3>

        <div className="mb-4">
          {milestoneProgress && (
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-neutral-grey3">
                Step {milestoneProgress.currentStep} –{" "}
                {milestoneProgress.currentStepTitle}
              </span>
            </div>
          )}
          <p className="text-xs text-neutral-grey3">
            {endDate
              ? `Deadline: ${dateFormatter.format(new Date(endDate))}`
              : "no deadline specified for this project"}
          </p>
          {milestoneProgress && (
            <div className="h-1 bg-gray-150 rounded-full overflow-hidden mt-2">
              <div
                className="h-full bg-green-60 rounded-full transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          )}
        </div>

        <Button
          variant="outline"
          size="small"
          className="w-full justify-center hover:bg-green-60 hover:text-white mb-0"
        >
          Learn more
        </Button>
      </div>
    </Link>
  );
}
