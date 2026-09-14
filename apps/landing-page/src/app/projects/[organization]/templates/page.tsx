import { notFound } from "next/navigation";

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
    <div className="w-full">
      <CatalogOrganizationHero
        organization={organization}
        extraBreadcrumbs={[{ name: "Templates" }]}
      />

      <div className="px-4 md:px-8 lg:px-12">
        <div className="max-w-[1200px] mx-auto">
          <ProjectTemplatesSection
            organizationSlug={organizationSlug}
            showMoreLink={false}
          />
        </div>
      </div>
    </div>
  );
}
