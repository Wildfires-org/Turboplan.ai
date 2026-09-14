"use client";

import { useMemo } from "react";

import type { CitizenSubmissionCardProject } from "@/components/dashboard/citizen-submission-card";
import { SubmissionsList } from "@/components/dashboard/submissions-list";
import {
  type UserSubmission,
  useUserSubmissions,
} from "@/hooks/use-user-submissions";
import { AppUrls } from "@/lib/nav/urls";

interface MySubmissionsSectionProps {
  organizationSlug: string;
  officeSlug: string;
}

// Map a /user/submissions row into the shape the submission card reads. The
// endpoint does not carry task counts or a creator avatar, so those default to
// empty values the card already guards against.
const toCardProject = (
  submission: UserSubmission,
): CitizenSubmissionCardProject => ({
  id: submission.id,
  slug: submission.projectSlug,
  name: submission.projectName,
  description: submission.projectDescription,
  coverImageUrl: submission.coverImageUrl,
  ownershipStatus: submission.ownershipStatus,
  createdAt: new Date(submission.createdAt),
  taskCount: 0,
  completedTaskCount: 0,
  creatorFirstName: submission.creatorFirstName,
  creatorLastName: submission.creatorLastName,
  creatorEmail: submission.creatorEmail,
  creatorAvatarUrl: null,
});

export const MySubmissionsSection = ({
  organizationSlug,
  officeSlug,
}: MySubmissionsSectionProps) => {
  // Citizen submissions are sourced from the submitter-keyed endpoint: after the
  // submit-time move the project leaves the citizen's office, so the office-
  // scoped projects list no longer contains it.
  const { submissions, isLoading } = useUserSubmissions();

  const cards = useMemo(() => submissions.map(toCardProject), [submissions]);

  // Each submitted project links to its CURRENT location (gov office while
  // submitted/accepted, citizen office after reject), keyed by submission id.
  const hrefById = useMemo(() => {
    const map = new Map<string, string>();
    for (const submission of submissions) {
      map.set(
        submission.id,
        AppUrls.project(
          submission.currentOrganizationSlug,
          submission.currentOfficeSlug,
          submission.projectSlug,
        ),
      );
    }
    return map;
  }, [submissions]);

  return (
    <SubmissionsList
      organizationSlug={organizationSlug}
      officeSlug={officeSlug}
      submissions={cards}
      isLoading={isLoading}
      getHref={(project) => hrefById.get(project.id) ?? "#"}
      emptyStateLabel="submissions"
    />
  );
};
