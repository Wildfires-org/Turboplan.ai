import type { PublicOffice } from "@wildfires-org/turboplan-public/types";

import OfficeCard from "./office-card";

interface OfficesListProps {
  offices: PublicOffice[];
  organizationSlug: string;
}

export function OfficesList({ offices, organizationSlug }: OfficesListProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
