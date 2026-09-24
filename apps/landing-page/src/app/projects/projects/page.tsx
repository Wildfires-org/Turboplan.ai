import { CatalogHero } from "@/components/catalog/catalog-hero";
import { CATALOG_PAGE_CLASS } from "@/components/catalog/catalog-layout";
import { ProjectsSection } from "@/components/catalog/projects-section";

export const dynamic = "force-dynamic";

export default function AllProjectsPage() {
  return (
    <div className={CATALOG_PAGE_CLASS}>
      <CatalogHero extraBreadcrumbs={[{ name: "All Projects" }]} />

      <ProjectsSection showMoreLink={false} />
    </div>
  );
}
