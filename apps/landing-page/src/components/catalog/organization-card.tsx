import { ChevronRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import type { PublicOrganization } from "@wildfires-org/turboplan-public/types";
import { cn } from "@wildfires-org/turboplan-utils";

import { CATALOG_CARD_LINK_CLASS } from "./catalog-layout";

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
    <>
      {organization.logoUrl?.trim() ? (
        <div className="relative size-12 shrink-0">
          <Image
            src={organization.logoUrl.trim()}
            alt={`${organization.name} logo`}
            fill
            sizes="48px"
            className="object-contain"
          />
        </div>
      ) : (
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-brandAlt-100 font-heading text-sm font-medium text-brand-800">
          {organization.name.slice(0, 2).toUpperCase().replace(".", "")}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-inter text-[15px] font-medium leading-[20px] text-egray-900">
          {organization.name}
        </p>
        <p className="mt-0.5 font-heading text-[12px] uppercase leading-[16px] tracking-[0.08em] text-egray-700">
          {organization.slug}
        </p>
      </div>
      {href && (
        <ChevronRight
          aria-hidden
          className="size-5 shrink-0 text-egray-700 transition-transform duration-200 ease-out-expo group-hover:translate-x-0.5 motion-reduce:transition-none"
        />
      )}
    </>
  );

  const cardClassName = "flex items-center gap-4 p-5";

  return (
    <li title={organization.name} className={cn("list-none", className)}>
      {href ? (
        <Link
          href={href}
          className={cn(CATALOG_CARD_LINK_CLASS, cardClassName)}
        >
          {content}
        </Link>
      ) : (
        <div className={cn("glass-card", cardClassName)}>{content}</div>
      )}
    </li>
  );
}
