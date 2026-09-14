"use client";

import { ChevronRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import type { PublicOffice } from "@wildfires-org/turboplan-public/types";
import { cn } from "@wildfires-org/turboplan-utils";

import { routing } from "@/utils/routing";

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
      className={cn(
        "group bg-white rounded-xl border border-neutral-grey overflow-hidden hover:shadow-md transition-shadow cursor-pointer block",
        className,
      )}
    >
      <div className="h-[120px] bg-gray-150 relative">
        {office.coverImageUrl ? (
          <Image
            src={office.coverImageUrl}
            alt={office.name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-neutral-grey3 text-sm">
            {office.name}
          </div>
        )}
      </div>

      <div className="p-4 flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-neutral-black truncate">
            {office.name}
          </p>
          {office.description && (
            <p className="text-xs text-neutral-grey3 mt-1 line-clamp-1">
              {office.description}
            </p>
          )}
        </div>
        <ChevronRight className="w-5 h-5 text-neutral-grey3 shrink-0 group-hover:translate-x-0.5 transition-transform" />
      </div>
    </Link>
  );
}
