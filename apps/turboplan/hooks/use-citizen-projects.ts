"use client";

import { useMemo } from "react";

import { OwnershipStatus } from "@wildfires-org/turboplan-db/types";
import type { ProjectWithCoverImage } from "@wildfires-org/turboplan-workspace/types";

import { useProjects } from "./use-projects";
import {
  type UserSubmission,
  useUserSubmissions,
} from "./use-user-submissions";

interface UseCitizenProjectsOptions {
  organizationSlug: string;
  officeSlug: string;
}

// A submitted item, normalized so the sidebar can build a link to the project's
// CURRENT location. After the submit-time move this points at the gov office;
// after a rejection it reverts to the citizen office.
export interface CitizenSubmittedProject {
  id: string;
  name: string;
  slug: string;
  organizationSlug: string;
  officeSlug: string;
}

const toSubmittedProject = (
  submission: UserSubmission,
): CitizenSubmittedProject => ({
  id: submission.id,
  name: submission.projectName,
  slug: submission.projectSlug,
  organizationSlug: submission.currentOrganizationSlug,
  officeSlug: submission.currentOfficeSlug,
});

export function useCitizenProjects({
  organizationSlug,
  officeSlug,
}: UseCitizenProjectsOptions) {
  // Drafts are NOT moved on submit — they stay in the citizen's office, so keep
  // sourcing them from the office-scoped projects endpoint.
  const {
    projects,
    isLoading: isLoadingProjects,
    error: projectsError,
  } = useProjects({
    organizationSlug,
    officeSlug,
    filters: { isTemplate: false, createdBy: "me" },
  });

  // Submitted/accepted/rejected projects have moved out of the citizen's office,
  // so they are sourced from the submitter-keyed submissions endpoint, which
  // reports each project's current location.
  const {
    submissions,
    isLoading: isLoadingSubmissions,
    error: submissionsError,
  } = useUserSubmissions();

  const drafts = useMemo<ProjectWithCoverImage[]>(
    () =>
      projects.filter(
        (p) =>
          !p.ownershipStatus || p.ownershipStatus === OwnershipStatus.DRAFT,
      ),
    [projects],
  );

  const submitted = useMemo<CitizenSubmittedProject[]>(
    () => submissions.map(toSubmittedProject),
    [submissions],
  );

  return {
    drafts,
    submitted,
    isLoading: isLoadingProjects || isLoadingSubmissions,
    error: projectsError || submissionsError,
  };
}
