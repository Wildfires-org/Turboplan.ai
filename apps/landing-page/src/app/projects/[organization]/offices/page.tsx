import { notFound } from "next/navigation";

import { CATALOG_PAGE_CLASS } from "@/components/catalog/catalog-layout";
import { CatalogOrganizationHero } from "@/components/catalog/catalog-organization-hero";
import { OfficesSection } from "@/components/catalog/organization-page/offices-section";
import { getOrganization } from "@/handlers/organizations";

interface OrganizationOfficesPageProps {
  params: Promise<{ organization: string }>;
}

export default async function OrganizationOfficesPage({
  params,
}: OrganizationOfficesPageProps) {
  const { organization: organizationSlug } = await params;

  const organization = await getOrganization(organizationSlug);

  if (!organization) {
    notFound();
  }

  return (
    <div className={CATALOG_PAGE_CLASS}>
      <CatalogOrganizationHero
        organization={organization}
        extraBreadcrumbs={[{ name: "Offices" }]}
      />

      <OfficesSection
        organizationId={organization.id}
        organizationSlug={organizationSlug}
        showAll
      />
    </div>
  );
}
