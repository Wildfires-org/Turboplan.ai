import { CatalogHero } from "@/components/catalog/catalog-hero";
import { CATALOG_PAGE_CLASS } from "@/components/catalog/catalog-layout";
import { ProjectTemplatesSection } from "@/components/catalog/project-templates-section";

export const dynamic = "force-dynamic";

export default function AllTemplatesPage() {
  return (
    <div className={CATALOG_PAGE_CLASS}>
      <CatalogHero extraBreadcrumbs={[{ name: "All Templates" }]} />

      <ProjectTemplatesSection showMoreLink={false} />
    </div>
  );
}
