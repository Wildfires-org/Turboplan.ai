import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { getLandingPageEnv } from "@wildfires-org/turboplan-env";
import type { PublicOffice } from "@wildfires-org/turboplan-public/types";

import { cn } from "@/lib/utils";
import { routing } from "@/utils/routing";
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
    <section className={cn("px-4 md:px-8 lg:px-12 py-12", className)}>
      <div className="max-w-[1200px] mx-auto">
        <p className="text-base text-green-60 mb-1">Who works here</p>
        <h2 className="text-2xl tracking-tight font-medium text-neutral-black mb-8">
          Offices
        </h2>

        <OfficesList offices={offices} organizationSlug={organizationSlug} />

        {hasMore && (
          <div className="flex justify-end mt-6">
            <Link
              href={routing.catalogOffices({ organizationSlug })}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-neutral-black bg-white border border-neutral-grey rounded-full hover:bg-gray-50 transition-colors"
            >
              More Offices
              <ArrowUpRight className="h-4 w-4 text-green-70" />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
