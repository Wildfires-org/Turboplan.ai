"use client";

import { useParams } from "next/navigation";

import { EntityPageFrameSkeleton } from "@/components/dashboard/office-page-frame";
import { OfficeRouteLoading } from "@/components/dashboard/office-route-loading";
import { OfficeSkeleton } from "@/components/dashboard/office-skeleton";
import { SKELETON_BAR_CLASS, STICKY_TOOLBAR_CLASS } from "@/lib/glass";
import { cn } from "@/lib/utils";

// This boundary also covers every office route while the office layout
// resolves (hard loads, switching offices), so defer to the office loading
// state there — it renders the real frame, tabs and toolbars.
export default function OrganizationLoading() {
  const params = useParams<{ officeSlug?: string }>();

  if (params.officeSlug) {
    return <OfficeRouteLoading />;
  }

  return (
    <EntityPageFrameSkeleton crumbs={1}>
      <div className="space-y-2">
        <div className={STICKY_TOOLBAR_CLASS}>
          <div className="flex items-center justify-between gap-4">
            <div className="glass h-10 w-72 rounded-full" />
            <div className="glass-inset hidden h-10 w-[340px] rounded-xl sm:block" />
          </div>
          <div className="mt-6 flex h-9 items-center">
            <span className={cn(SKELETON_BAR_CLASS, "h-9 w-32 rounded-full")} />
          </div>
        </div>
        <OfficeSkeleton />
      </div>
    </EntityPageFrameSkeleton>
  );
}
