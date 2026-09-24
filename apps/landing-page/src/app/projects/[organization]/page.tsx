import { notFound } from "next/navigation";

import { CATALOG_PAGE_CLASS } from "@/components/catalog/catalog-layout";
import { CatalogOrganizationHero } from "@/components/catalog/catalog-organization-hero";
import { OfficesSection } from "@/components/catalog/organization-page/offices-section";
import { ProjectTemplatesSection } from "@/components/catalog/project-templates-section";
import { ProjectsSection } from "@/components/catalog/projects-section";
import { getOrganization } from "@/handlers/organizations";

interface OrganizationPageProps {
  params: Promise<{ organization: string }>;
}

export default async function OrganizationPage({
  params,
}: OrganizationPageProps) {
  const { organization: organizationSlug } = await params;

  const organization = await getOrganization(organizationSlug);

  if (!organization) {
    notFound();
  }

  return (
    <div className={CATALOG_PAGE_CLASS}>
      <CatalogOrganizationHero organization={organization} />

      <OfficesSection
        organizationId={organization.id}
        organizationSlug={organizationSlug}
      />

      <ProjectTemplatesSection
        organizationId={organization.id}
        organizationSlug={organizationSlug}
      />

      <ProjectsSection organizationSlug={organizationSlug} limit={3} />
    </div>
  );
}
