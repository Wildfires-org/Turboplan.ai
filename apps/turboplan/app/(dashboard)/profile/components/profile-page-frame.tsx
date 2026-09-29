import type { ReactNode } from "react";

import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import {
  PAGE_CONTAINER_CLASS,
  PAGE_LEAD_CLASS,
  PAGE_TITLE_CLASS,
} from "@/lib/glass";
import { cn } from "@/lib/utils";

const PROFILE_BREADCRUMBS = [{ label: "Profile", isActive: true }];

/** Header bar + page title + content column shared by the profile page and
 * its loading state, so both render the same geometry. */
export function ProfilePageFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen shrink-0 flex-col">
      <DashboardHeader breadcrumbs={PROFILE_BREADCRUMBS} />
      <div className={cn(PAGE_CONTAINER_CLASS, "flex-1 pb-12 pt-8")}>
        <div className="mx-auto max-w-4xl">
          <div className="mb-6">
            <h1 className={PAGE_TITLE_CLASS}>Profile</h1>
            <p className={cn(PAGE_LEAD_CLASS, "mt-1.5")}>
              Your account details, access tokens and display preferences.
            </p>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

/** Field label above an inset input. */
export const PROFILE_LABEL_CLASS =
  "text-[13px] font-medium leading-5 text-foreground";

/** Section heading inside a profile panel. */
export const PROFILE_SECTION_TITLE_CLASS =
  "text-[15px] font-medium leading-6 tracking-[-0.01em] text-foreground";

/** Hairline between sections of a panel. */
export const PROFILE_DIVIDER_CLASS =
  "border-t border-slate-900/[0.06] dark:border-white/10";
