import Link from "next/link";

import { SKELETON_BAR_CLASS } from "@/lib/glass";
import { cn } from "@/lib/utils";
import {
  type BreadcrumbEntity,
  BreadcrumbEntityActions,
} from "./breadcrumb-entity-actions";

interface Breadcrumb {
  label: string;
  href?: string;
  isActive?: boolean;
  entity?: BreadcrumbEntity;
}

/** Sticky glass breadcrumb bar (64px; sticky offsets below depend on it). */
const DASHBOARD_HEADER_CLASS =
  "sticky top-0 z-30 flex h-16 shrink-0 items-center gap-4 border-b border-white/80 bg-white/75 px-4 shadow-[0_1px_0_rgba(255,255,255,0.9),0_8px_24px_-20px_rgba(15,23,42,0.25)] backdrop-blur-xl backdrop-saturate-150 lg:px-6 dark:border-white/10 dark:bg-slate-950/75";

interface DashboardHeaderProps {
  breadcrumbs?: Breadcrumb[];
  userId?: string;
}

export function DashboardHeader({
  breadcrumbs = [{ label: "Projects", isActive: true }],
  userId,
}: DashboardHeaderProps) {
  return (
    <header className={DASHBOARD_HEADER_CLASS}>
      {/* Breadcrumbs */}
      <nav
        aria-label="Breadcrumb"
        className="flex min-w-0 items-center gap-2 overflow-hidden text-sm"
      >
        {breadcrumbs.map((breadcrumb, index) => (
          <div
            key={index}
            className="flex min-w-0 shrink-0 items-center gap-3 last:shrink"
          >
            {index > 0 && (
              <span aria-hidden className="text-slate-300">
                /
              </span>
            )}
            {breadcrumb.entity ? (
              <BreadcrumbEntityActions
                label={breadcrumb.label}
                href={breadcrumb.href ?? ""}
                entity={breadcrumb.entity}
                userId={userId}
                isActive={breadcrumb.isActive}
              />
            ) : breadcrumb.href && !breadcrumb.isActive ? (
              <Link
                href={breadcrumb.href}
                className="text-gray-550 transition-colors hover:text-foreground"
              >
                {breadcrumb.label}
              </Link>
            ) : (
              <span
                className={
                  breadcrumb.isActive
                    ? "truncate font-medium text-foreground"
                    : "text-gray-550"
                }
              >
                {breadcrumb.label}
              </span>
            )}
          </div>
        ))}
      </nav>
    </header>
  );
}

/** Header bar with placeholder crumbs, for loading states that don't know
 * the entity names yet. Same shell, so nothing below it moves. */
export function DashboardHeaderSkeleton({ crumbs = 2 }: { crumbs?: number }) {
  return (
    <header className={DASHBOARD_HEADER_CLASS}>
      <div aria-hidden className="flex h-5 items-center gap-3">
        {Array.from({ length: crumbs }, (_, index) => (
          <div key={index} className="flex items-center gap-3">
            {index > 0 && <span className="text-sm text-slate-300">/</span>}
            <span className={cn(SKELETON_BAR_CLASS, "h-3.5 w-28")} />
          </div>
        ))}
      </div>
    </header>
  );
}
