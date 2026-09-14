import Link from "next/link";

import { CatalogHero } from "@/components/catalog/catalog-hero";
import { ProjectsSection } from "@/components/catalog/projects-section";
import { routing } from "@/utils/routing";

export const dynamic = "force-dynamic";

export default function AllProjectsPage() {
  return (
    <div className="w-full">
      <CatalogHero />

      <div className="px-4 md:px-8 lg:px-12">
        <div className="max-w-[1200px] mx-auto">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-neutral-grey3 pt-6">
            <Link href={routing.catalog()} className="hover:text-neutral-black">
              Projects
            </Link>
            <span>/</span>
            <span className="text-neutral-black">All Projects</span>
          </nav>

          <ProjectsSection showMoreLink={false} />
        </div>
      </div>
    </div>
  );
}
