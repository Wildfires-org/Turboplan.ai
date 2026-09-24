import { ArrowUpRight, Building2 } from "lucide-react";
import Link from "next/link";

import { getLandingPageEnv } from "@wildfires-org/turboplan-env";
import type { PublicOffice } from "@wildfires-org/turboplan-public/types";

import { PAGE_CONTAINER } from "@/components/home-v2/ui/layout";
import { cn } from "@/lib/utils";
import { routing } from "@/utils/routing";
import { CATALOG_SECTION_CLASS, GLASS_BUTTON_CLASS } from "../catalog-layout";
import { CatalogSectionHeader } from "../catalog-section-header";
import { OfficesList } from "./offices-list";

const PAGE_SIZE = 9;

interface OfficesSectionProps {
  organizationId: string;
  organizationSlug: string;
  /** When true, fetches all offices (for the dedicated offices list page) */
  showAll?: boolean;
  className?: string;
}

interface PaginatedOfficesResponse {
  items: PublicOffice[];
  total: number;
}

async function getOffices(
  organizationId: string,
  limit?: number,
): Promise<PaginatedOfficesResponse> {
  const { SERVER_URL } = getLandingPageEnv();

  const params = new URLSearchParams({
    organizationId,
    offset: "0",
  });
  if (limit !== undefined) {
    params.set("limit", String(limit));
  }

  try {
    const response = await fetch(
      `${SERVER_URL}/api/public/offices?${params.toString()}`,
      {
        next: { revalidate: 60 },
      },
    );

    if (!response.ok) {
      console.error(
        `[OfficesSection] Failed to fetch offices for organization "${organizationId}": ${response.status} ${response.statusText}`,
      );
      return { items: [], total: 0 };
    }

    return await response.json();
  } catch (error) {
    console.error(
      `[OfficesSection] Error fetching offices for organization "${organizationId}":`,
      error,
    );
    return { items: [], total: 0 };
  }
}

export async function OfficesSection({
  organizationId,
  organizationSlug,
  showAll = false,
  className,
}: OfficesSectionProps) {
  const { items: offices, total } = await getOffices(
    organizationId,
    showAll ? undefined : PAGE_SIZE,
  );

  if (offices.length === 0) {
    return null;
  }

  const hasMore = !showAll && total > PAGE_SIZE;

  return (
    <section className={cn(CATALOG_SECTION_CLASS, className)}>
      <div className={PAGE_CONTAINER}>
        <CatalogSectionHeader
          icon={Building2}
          eyebrow="Who works here"
          title="Offices"
        />

        <OfficesList offices={offices} organizationSlug={organizationSlug} />

        {hasMore && (
          <div className="mt-8 flex justify-end">
            <Link
              href={routing.catalogOffices({ organizationSlug })}
              className={GLASS_BUTTON_CLASS}
            >
              More Offices
              <ArrowUpRight className="size-4" />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
