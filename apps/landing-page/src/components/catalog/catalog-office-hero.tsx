import type {
  PublicOfficeWithOrg,
  PublicOrganization,
} from "@wildfires-org/turboplan-public/types";

import { OfficeHeaderCard } from "@/components/catalog/office-page/office-header-card";
import { OfficeHero } from "@/components/catalog/office-page/office-hero";
import { PAGE_CONTAINER } from "@/components/home-v2/ui/layout";
import { CATALOG_TOP_CLASS } from "./catalog-layout";
import type { BreadcrumbItem } from "./types";

interface CatalogOfficeHeroProps {
  organization: PublicOrganization;
  office: PublicOfficeWithOrg;
  extraBreadcrumbs?: BreadcrumbItem[];
}

export function CatalogOfficeHero({
  organization,
  office,
  extraBreadcrumbs,
}: CatalogOfficeHeroProps) {
  return (
    <section className={CATALOG_TOP_CLASS}>
      <div className={PAGE_CONTAINER}>
        <OfficeHero
          organization={organization}
          office={office}
          extraBreadcrumbs={extraBreadcrumbs}
        />
        <OfficeHeaderCard
          organization={organization}
          office={office}
          className="mt-8 sm:mt-10"
        />
      </div>
    </section>
  );
}
