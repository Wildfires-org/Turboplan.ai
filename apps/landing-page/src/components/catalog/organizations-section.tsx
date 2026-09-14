import { getLandingPageEnv } from "@wildfires-org/turboplan-env";
import type { PublicOrganization } from "@wildfires-org/turboplan-public/types";

import { OrganizationsList } from "@/components/catalog/organizations-list";
import { cn } from "@/lib/utils";
import { OrganizationsSectionHeader } from "./organizations-section-header";

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
      <section
        className={cn(
          "bg-white/95 p-6 md:p-12 drop-shadow mt-6 w-full max-w-[1080px] mx-auto rounded-t-3xl",
          className,
        )}
      >
        <OrganizationsSectionHeader />

        <div className="text-center py-16 text-neutral-grey3 mt-14 border-t border-neutral-grey">
          No agencies found.
        </div>
      </section>
    );
  }

  return (
    <OrganizationsList organizations={organizations} className={className} />
  );
}
