"use client";

import { ChevronRight, ImageIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import type { PublicOffice } from "@wildfires-org/turboplan-public/types";
import { cn } from "@wildfires-org/turboplan-utils";

import { routing } from "@/utils/routing";
import { CATALOG_CARD_LINK_CLASS } from "../catalog-layout";

interface OfficeCardProps {
  office: PublicOffice;
  organizationSlug: string;
  className?: string;
}

export default function OfficeCard({
  office,
  organizationSlug,
  className,
}: OfficeCardProps) {
  return (
    <Link
      href={routing.catalogOffice({
        organizationSlug,
        officeSlug: office.slug,
      })}
      className={cn(CATALOG_CARD_LINK_CLASS, "flex flex-col", className)}
    >
      <div className="p-2 pb-0">
        <div className="relative h-[132px] overflow-hidden rounded-xl bg-brandAlt-100">
          {office.coverImageUrl ? (
            <Image
              src={office.coverImageUrl}
              alt={office.name}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 400px"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <ImageIcon className="size-8 text-brand-800/30" />
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-1 items-center justify-between gap-3 p-5">
        <div className="min-w-0">
          <p className="truncate font-inter text-[15px] font-medium leading-[20px] text-egray-900">
            {office.name}
          </p>
          {office.description && (
            <p className="mt-1 line-clamp-1 font-inter text-[13px] leading-[18px] text-egray-700">
              {office.description}
            </p>
          )}
        </div>
        <ChevronRight
          aria-hidden
          className="size-5 shrink-0 text-egray-700 transition-transform duration-200 ease-out-expo group-hover:translate-x-0.5 motion-reduce:transition-none"
        />
      </div>
    </Link>
  );
}
