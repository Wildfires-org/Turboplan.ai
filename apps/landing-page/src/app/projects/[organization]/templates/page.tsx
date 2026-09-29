import { notFound } from "next/navigation";

import { CATALOG_PAGE_CLASS } from "@/components/catalog/catalog-layout";
import { CatalogOrganizationHero } from "@/components/catalog/catalog-organization-hero";
import { ProjectTemplatesSection } from "@/components/catalog/project-templates-section";
import { getOrganization } from "@/handlers/organizations";

interface OrganizationTemplatesPageProps {
  params: Promise<{ organization: string }>;
}

export default async function OrganizationTemplatesPage({
  params,
}: OrganizationTemplatesPageProps) {
  const { organization: organizationSlug } = await params;

  const organization = await getOrganization(organizationSlug);

  if (!organization) {
    notFound();
  }

  return (
    <div className={CATALOG_PAGE_CLASS}>
      <CatalogOrganizationHero
        organization={organization}
        extraBreadcrumbs={[{ name: "Templates" }]}
      />

      <ProjectTemplatesSection
        organizationSlug={organizationSlug}
        showMoreLink={false}
      />
    </div>
  );
}
