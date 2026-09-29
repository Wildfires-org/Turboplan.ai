import type { PublicOrganization } from "@wildfires-org/turboplan-public/types";

import { OrganizationHeaderCard } from "@/components/catalog/organization-page/organization-header-card";
import { OrganizationHero } from "@/components/catalog/organization-page/organization-hero";
import { PAGE_CONTAINER } from "@/components/home-v2/ui/layout";
import { CATALOG_TOP_CLASS } from "./catalog-layout";
import type { BreadcrumbItem } from "./types";

interface CatalogOrganizationHeroProps {
  organization: PublicOrganization;
  extraBreadcrumbs?: BreadcrumbItem[];
}

export function CatalogOrganizationHero({
  organization,
  extraBreadcrumbs,
}: CatalogOrganizationHeroProps) {
  return (
    <section className={CATALOG_TOP_CLASS}>
      <div className={PAGE_CONTAINER}>
        <OrganizationHero
          organizationAbbreviation={organization.slug}
          organizationSlug={organization.slug}
          organizationType={organization.type}
          extraBreadcrumbs={extraBreadcrumbs}
        />
        <OrganizationHeaderCard
          organization={organization}
          className="mt-8 sm:mt-10"
        />
      </div>
    </section>
  );
}
