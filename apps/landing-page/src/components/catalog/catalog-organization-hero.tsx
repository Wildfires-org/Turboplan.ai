import Image from "next/image";

import type { PublicOrganization } from "@wildfires-org/turboplan-public/types";

import CatalogHeroImage from "@/../public/home/catalog-hero.png";
import { OrganizationHeaderCard } from "@/components/catalog/organization-page/organization-header-card";
import { OrganizationHero } from "@/components/catalog/organization-page/organization-hero";
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
    <section className="flex flex-col bg-gray-500 px-4 -mt-[88px] pt-6 md:pt-8 pb-0 relative mb-8 md:mb-12 overflow-hidden max-md:-mx-5 rounded-t-3xl">
      <OrganizationHero
        organizationAbbreviation={organization.slug}
        organizationSlug={organization.slug}
        organizationType={organization.type}
        extraBreadcrumbs={extraBreadcrumbs}
      />
      <div className="relative z-10 mt-4 md:mt-6">
        <OrganizationHeaderCard
          organization={organization}
          className="rounded-t-3xl"
        />
      </div>
      <Image
        src={organization.coverImageUrl ?? CatalogHeroImage}
        alt="Organization Hero"
        fill
        className="object-cover z-0 absolute inset-0 w-full"
      />
      {organization.coverImageUrl && (
        <div className="absolute inset-0 z-0 bg-black/30" />
      )}
    </section>
  );
}
