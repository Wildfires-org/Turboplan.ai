import type { PublicOffice } from "@wildfires-org/turboplan-public/types";

import { CATALOG_GRID_CLASS } from "../catalog-layout";
import OfficeCard from "./office-card";

interface OfficesListProps {
  offices: PublicOffice[];
  organizationSlug: string;
}

export function OfficesList({ offices, organizationSlug }: OfficesListProps) {
  return (
    <div className={CATALOG_GRID_CLASS}>
      {offices.map((office) => (
        <OfficeCard
          key={office.id}
          office={office}
          organizationSlug={organizationSlug}
        />
      ))}
    </div>
  );
}
