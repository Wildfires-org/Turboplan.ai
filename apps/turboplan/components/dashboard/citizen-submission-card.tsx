import { Calendar, ListChecks } from "lucide-react";
import Image from "next/image";

import { OwnershipStatus } from "@wildfires-org/turboplan-db/types";

import { EntityCard } from "@/components/dashboard/entity-card";
import { MetadataChip } from "@/components/dashboard/metadata-chip";
import {
  type SubmissionStatus,
  SubmissionStatusBadge,
} from "@/components/dashboard/submission-status-badge";

// The exact fields this card reads. ProjectWithCoverImage (gov path) is
// structurally assignable to this, and the citizen /user/submissions row is
// mapped into it. Kept narrow so the submission row need not fabricate every
// Project column.
export type CitizenSubmissionCardProject = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  coverImageUrl: string | null;
  ownershipStatus: string;
  createdAt: Date;
  taskCount: number;
  completedTaskCount: number;
  creatorFirstName: string | null;
  creatorLastName: string | null;
  creatorEmail: string | null;
  creatorAvatarUrl: string | null;
};

type CitizenSubmissionCardProps = {
  project: CitizenSubmissionCardProject;
  href: string;
};

const formatDate = (date: Date) =>
  new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const formatCreatorName = (project: CitizenSubmissionCardProject) => {
  if (project.creatorFirstName || project.creatorLastName) {
    return [project.creatorFirstName, project.creatorLastName]
      .filter(Boolean)
      .join(" ");
  }
  return project.creatorEmail ?? "Unknown";
};

const ownershipToSubmissionStatus: Record<string, SubmissionStatus> = {
  [OwnershipStatus.SUBMITTED]: "new",
  [OwnershipStatus.ACCEPTED]: "approved",
  [OwnershipStatus.REJECTED]: "rejected",
};

export function CitizenSubmissionCard({
  project,
  href,
}: CitizenSubmissionCardProps) {
  const submissionStatus =
    ownershipToSubmissionStatus[project.ownershipStatus] ?? "new";

  return (
    <EntityCard
      className="h-[344px]"
      href={href}
      coverImageUrl={project.coverImageUrl}
      badges={<SubmissionStatusBadge status={submissionStatus} />}
      title={project.name}
      description={project.description}
      metadata={
        <>
          {project.createdAt && (
            <MetadataChip icon={Calendar}>
              {formatDate(project.createdAt)}
            </MetadataChip>
          )}
          {project.taskCount > 0 && (
            <MetadataChip icon={ListChecks}>
              <span className="font-semibold">
                {project.completedTaskCount}/{project.taskCount}
              </span>{" "}
              tasks
            </MetadataChip>
          )}
        </>
      }
      footer={
        <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-550">
          Submitted by:
          <span className="inline-flex items-center gap-1 text-foreground">
            {project.creatorAvatarUrl ? (
              <Image
                src={project.creatorAvatarUrl}
                alt=""
                width={14}
                height={14}
                className="rounded-full"
              />
            ) : (
              <span className="flex size-3.5 items-center justify-center rounded-full bg-brandAlt-200 text-[8px] font-medium text-brand-900">
                {(
                  project.creatorFirstName?.[0] ||
                  project.creatorEmail?.[0] ||
                  "?"
                ).toUpperCase()}
              </span>
            )}
            {formatCreatorName(project)}
          </span>
        </span>
      }
    />
  );
}
