import { getLandingPageEnv } from "@wildfires-org/turboplan-env";
import type { PublicOrganization } from "@wildfires-org/turboplan-public/types";

import { OrganizationsList } from "@/components/catalog/organizations-list";
import { cn } from "@/lib/utils";

interface OrganizationsSectionProps {
  className?: string;
}

async function getOrganizations(): Promise<PublicOrganization[]> {
  const { SERVER_URL } = getLandingPageEnv();

  try {
    const response = await fetch(`${SERVER_URL}/api/public/organizations`, {
      next: { revalidate: 60 },
    });

    if (!response.ok) {
      console.error(
        `[OrganizationsSection] Failed to fetch organizations: ${response.status} ${response.statusText}`,
      );
      return [];
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error(
      "[OrganizationsSection] Error fetching organizations:",
      error,
    );
    return [];
  }
}

export async function OrganizationsSection({
  className,
}: OrganizationsSectionProps) {
  const organizations = await getOrganizations();

  if (!organizations || organizations.length === 0) {
    return (
      <div
        className={cn(
          "glass-card px-6 py-12 text-center font-inter text-[15px] text-egray-700",
          className,
        )}
      >
        No agencies found.
      </div>
    );
  }

  return (
    <OrganizationsList organizations={organizations} className={className} />
  );
}
