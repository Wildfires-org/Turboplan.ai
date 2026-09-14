"use client";

import { useMemo } from "react";

import { OwnershipStatus } from "@wildfires-org/turboplan-db/types";

import { SubmissionsList } from "@/components/dashboard/submissions-list";
import { useProjects } from "@/hooks/use-projects";
import { AppUrls } from "@/lib/nav/urls";

// ── Constants ─────────────────────────────────────────────────────────

const SUBMISSION_STATUSES = new Set([
  OwnershipStatus.SUBMITTED,
  OwnershipStatus.ACCEPTED,
  OwnershipStatus.REJECTED,
]);

// ── Types ─────────────────────────────────────────────────────────────

interface SubmissionsSectionProps {
  organizationSlug: string;
  officeSlug: string;
  createdByMe?: boolean;
  emptyStateLabel?: string;
}

// ── Component ─────────────────────────────────────────────────────────

export const SubmissionsSection = ({
  organizationSlug,
  officeSlug,
  createdByMe = false,
  emptyStateLabel = "submissions",
}: SubmissionsSectionProps) => {
  // Gov reviewers see submissions via the office-scoped projects endpoint:
  // after the submit-time move the project lives in this office, so it is
  // visible here through inherited RBAC.
  const { projects, isLoading } = useProjects({
    organizationSlug,
    officeSlug,
    filters: {
      isTemplate: false,
      ...(createdByMe ? { createdBy: "me" as const } : {}),
    },
  });

  const submissions = useMemo(
    () =>
      projects.filter((p) =>
        SUBMISSION_STATUSES.has(p.ownershipStatus as OwnershipStatus),
      ),
    [projects],
  );

  return (
    <SubmissionsList
      organizationSlug={organizationSlug}
      officeSlug={officeSlug}
      submissions={submissions}
      isLoading={isLoading}
      getHref={(project) =>
        AppUrls.project(organizationSlug, officeSlug, project.slug)
      }
      emptyStateLabel={emptyStateLabel}
    />
  );
};
