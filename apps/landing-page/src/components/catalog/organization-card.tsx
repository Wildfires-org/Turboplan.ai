import Image from "next/image";
import Link from "next/link";

import type { PublicOrganization } from "@wildfires-org/turboplan-public/types";
import { cn } from "@wildfires-org/turboplan-utils";

interface OrganizationCardProps {
  organization: PublicOrganization;
  href?: string;
  className?: string;
}

export function OrganizationCard({
  organization,
  href,
  className,
}: OrganizationCardProps) {
  const content = (
    <li
      role="listitem"
      title={organization.name}
      className={cn(
        "flex items-center gap-4 p-5 border-b border-r border-neutral-grey/40 hover:bg-neutral-50 transition-colors cursor-pointer",
        className,
      )}
    >
      {/* Organization logo */}
      {organization.logoUrl?.trim() ? (
        <div className="w-12 h-12 shrink-0 relative">
          <Image
            src={organization.logoUrl.trim()}
            alt={`${organization.name} logo`}
            fill
            className="object-contain"
          />
        </div>
      ) : (
        <div className="w-12 h-12 bg-gray-150 flex items-center justify-center text-sm font-medium text-neutral-grey3 shrink-0">
          {organization.name.slice(0, 2).toUpperCase().replace(".", "")}
        </div>
      )}
      <div className="min-w-0">
        <p className="text-sm font-medium text-neutral-black truncate">
          {organization.name}
        </p>
        <p className="text-xs text-neutral-grey3">
          {organization.slug?.toUpperCase()}
        </p>
      </div>
    </li>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}
