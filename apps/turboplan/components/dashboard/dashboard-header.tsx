import Link from "next/link";

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

interface DashboardHeaderProps {
  breadcrumbs?: Breadcrumb[];
  userId?: string;
}

export function DashboardHeader({
  breadcrumbs = [{ label: "Projects", isActive: true }],
  userId,
}: DashboardHeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-4 border-b border-white bg-white px-4 shadow-[0_1px_0_rgba(255,255,255,0.9)] lg:px-6">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-sm">
        {breadcrumbs.map((breadcrumb, index) => (
          <div key={index} className="flex items-center gap-3">
            {index > 0 && <span className="text-gray-400">/</span>}
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
                className="text-gray-400 hover:text-foreground transition-colors"
              >
                {breadcrumb.label}
              </Link>
            ) : (
              <span
                className={
                  breadcrumb.isActive
                    ? "text-foreground"
                    : "text-muted-foreground"
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
