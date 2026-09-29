import type { ReactNode } from "react";

import Image from "next/image";

import { cn } from "@/lib/utils";

interface CatalogHeaderShellProps {
  coverImageUrl?: string | null;
  coverAlt: string;
  children: ReactNode;
  className?: string;
}

// Big glass shell for the organization / office page header. The entity's
// cover image, when it has one, sits as a media band on top instead of a
// full-bleed page background, so the page ground stays flat.
export function CatalogHeaderShell({
  coverImageUrl,
  coverAlt,
  children,
  className,
}: CatalogHeaderShellProps) {
  return (
    <div className={cn("glass-card overflow-hidden rounded-[28px]", className)}>
      {coverImageUrl && (
        <div className="p-2 pb-0 sm:p-2.5 sm:pb-0">
          <div className="relative h-32 overflow-hidden rounded-[20px] bg-brandAlt-200 sm:h-44 lg:h-52">
            <Image
              src={coverImageUrl}
              alt={coverAlt}
              fill
              priority
              sizes="(max-width: 1200px) 100vw, 1200px"
              className="object-cover"
            />
          </div>
        </div>
      )}
      <div className="p-6 sm:p-8 lg:p-10">
        <div className="mx-auto w-full max-w-[760px]">{children}</div>
      </div>
    </div>
  );
}
