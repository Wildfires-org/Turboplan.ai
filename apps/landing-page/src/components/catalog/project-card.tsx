import { ArrowRight, ImageIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/utils";
import type { PublicProject } from "@/types/public-project";
import { routing } from "@/utils/routing";
import {
  CARD_ACTION_CLASS,
  CARD_ACTION_ICON_CLASS,
  CARD_CHIP_CLASS,
  CATALOG_CARD_LINK_CLASS,
} from "./catalog-layout";

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
      className={cn(CATALOG_CARD_LINK_CLASS, "flex flex-col", className)}
    >
      <div className="p-2 pb-0">
        <div className="relative aspect-video overflow-hidden rounded-xl bg-brandAlt-100">
          {project.coverImageUrl ? (
            <Image
              src={project.coverImageUrl}
              alt={project.name}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 400px"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <ImageIcon className="size-8 text-brand-800/30" />
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <span
            className={cn(
              CARD_CHIP_CLASS,
              isCompleted ? "text-brand-800" : "text-egray-700",
            )}
          >
            {isCompleted ? "Completed" : "In Progress"}
          </span>
          {organization.logoUrl ? (
            <Image
              src={organization.logoUrl}
              alt={organization.name}
              width={32}
              height={32}
              className="size-8 object-contain"
            />
          ) : (
            <div className="flex size-8 items-center justify-center rounded-lg bg-brandAlt-100 font-heading text-xs text-brand-800">
              {organization.name.slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>

        <p className="mb-1 line-clamp-1 font-inter text-[13px] leading-[18px] text-egray-700">
          {organization.name} / {office.name}
        </p>
        <h3 className="mb-3 line-clamp-2 font-inter text-[16px] font-medium leading-[22px] text-egray-900">
          {project.name}
        </h3>

        <div className="font-inter text-[13px] leading-[18px] text-egray-700">
          {milestoneProgress && (
            <p className="mb-1 line-clamp-1">
              Step {milestoneProgress.currentStep} –{" "}
              {milestoneProgress.currentStepTitle}
            </p>
          )}
          <p>
            {endDate
              ? `Deadline: ${dateFormatter.format(new Date(endDate))}`
              : "no deadline specified for this project"}
          </p>
          {milestoneProgress && (
            <div
              role="progressbar"
              aria-label="Milestone progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progressPercent)}
              className="mt-3 h-1.5 overflow-hidden rounded-full bg-brandAlt-200"
            >
              <div
                className="h-full rounded-full bg-brand-700"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          )}
        </div>

        <div className="mt-auto pt-5">
          <span className={CARD_ACTION_CLASS}>
            Learn more
            <ArrowRight aria-hidden className={CARD_ACTION_ICON_CLASS} />
          </span>
        </div>
      </div>
    </Link>
  );
}
