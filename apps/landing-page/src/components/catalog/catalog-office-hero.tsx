import Image from "next/image";

import type {
  PublicOfficeWithOrg,
  PublicOrganization,
} from "@wildfires-org/turboplan-public/types";

import CatalogHeroImage from "@/../public/home/catalog-hero.png";
import { OfficeHeaderCard } from "@/components/catalog/office-page/office-header-card";
import { OfficeHero } from "@/components/catalog/office-page/office-hero";
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
    <section className="flex flex-col bg-gray-500 px-4 -mt-[88px] pt-6 md:pt-8 relative mb-8 md:mb-12 overflow-hidden max-md:-mx-5 rounded-t-3xl">
      <OfficeHero
        organization={organization}
        office={office}
        extraBreadcrumbs={extraBreadcrumbs}
        className="z-10"
      />
      <div className="relative z-10 mt-4 md:mt-6">
        <OfficeHeaderCard organization={organization} office={office} />
      </div>
      <Image
        src={
          office.coverImageUrl ?? organization.coverImageUrl ?? CatalogHeroImage
        }
        alt="Office Hero"
        fill
        className="object-cover z-0 absolute inset-0 w-full"
      />
      {(office.coverImageUrl ?? organization.coverImageUrl) && (
        <div className="absolute inset-0 z-0 bg-black/30" />
      )}
    </section>
  );
}
