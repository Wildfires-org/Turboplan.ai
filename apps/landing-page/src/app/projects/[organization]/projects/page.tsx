import { notFound } from "next/navigation";

import { CATALOG_PAGE_CLASS } from "@/components/catalog/catalog-layout";
import { CatalogOrganizationHero } from "@/components/catalog/catalog-organization-hero";
import { ProjectsSection } from "@/components/catalog/projects-section";
import { getOrganization } from "@/handlers/organizations";

interface OrganizationProjectsPageProps {
  params: Promise<{ organization: string }>;
}

export default async function OrganizationProjectsPage({
  params,
}: OrganizationProjectsPageProps) {
  const { organization: organizationSlug } = await params;

  const organization = await getOrganization(organizationSlug);

  if (!organization) {
    notFound();
  }

  return (
    <div className={CATALOG_PAGE_CLASS}>
      <CatalogOrganizationHero
        organization={organization}
        extraBreadcrumbs={[{ name: "Projects" }]}
      />

      <ProjectsSection
        organizationSlug={organizationSlug}
        showMoreLink={false}
      />
    </div>
  );
}
