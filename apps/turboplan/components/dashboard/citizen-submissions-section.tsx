"use client";

import { SubmissionsSection } from "@/components/dashboard/submissions-section";

interface CitizenSubmissionsSectionProps {
  organizationSlug: string;
  officeSlug: string;
}

export const CitizenSubmissionsSection = ({
  organizationSlug,
  officeSlug,
}: CitizenSubmissionsSectionProps) => {
  return (
    <SubmissionsSection
      organizationSlug={organizationSlug}
      officeSlug={officeSlug}
      emptyStateLabel="citizen submissions"
    />
  );
};
