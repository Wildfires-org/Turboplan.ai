import { notFound } from "next/navigation";

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
    <div className="w-full">
      <CatalogOrganizationHero organization={organization} />

      <OfficesSection
        organizationId={organization.id}
        organizationSlug={organizationSlug}
        showAll
      />
    </div>
  );
}
