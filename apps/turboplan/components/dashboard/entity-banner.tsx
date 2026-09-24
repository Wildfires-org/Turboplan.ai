import Image from "next/image";

import {
  PAGE_CONTAINER_CLASS,
  PAGE_LEAD_CLASS,
  PAGE_TITLE_CLASS,
} from "@/lib/glass";
import { cn } from "@/lib/utils";

type EntityBannerProps = {
  coverImageUrl?: string | null;
  logoUrl?: string | null;
  /** A node so loading states can pass a placeholder with the same metrics. */
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
};

export function EntityBanner({
  coverImageUrl,
  logoUrl,
  title,
  description,
  actions,
  className,
}: EntityBannerProps) {
  // next/image throws on an empty/whitespace src, and a blank string is truthy
  // so a plain `logoUrl &&` guard does not catch it. Normalize blank values to
  // null and trim stray whitespace so a cleared/malformed logo just falls back.
  const safeLogoUrl = logoUrl?.trim() || null;
  const safeCoverImageUrl =
    coverImageUrl?.trim() || "/images/banner-placeholder.jpg";

  return (
    <div className={cn(PAGE_CONTAINER_CLASS, "pt-5", className)}>
      <div className="glass-card overflow-hidden rounded-[24px]">
        {/* Cover inset in the glass shell (landing header-shell pattern). */}
        <div className="p-2 pb-0">
          <div className="relative h-[124px] overflow-hidden rounded-[18px] bg-brandAlt-200">
            <Image
              src={safeCoverImageUrl}
              alt=""
              fill
              priority
              className="object-cover object-center"
              sizes="(max-width: 1224px) 100vw, 1224px"
            />
          </div>
        </div>

        <div
          className={cn(
            "relative px-5 pb-5 sm:px-6 sm:pb-6",
            safeLogoUrl ? "pt-[52px]" : "pt-5",
          )}
        >
          {/* Logo overlapping the bottom edge of the cover */}
          {safeLogoUrl && (
            <div className="absolute -top-9 left-5 z-10 flex size-[72px] items-center justify-center rounded-2xl border-[3px] border-white bg-white shadow-[0_10px_24px_-12px_rgba(15,23,42,0.35)] sm:left-6">
              <Image
                src={safeLogoUrl}
                alt=""
                width={49}
                height={55}
                className="object-contain"
              />
            </div>
          )}

          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <h1 className={PAGE_TITLE_CLASS}>{title}</h1>
              {description && (
                <p className={cn(PAGE_LEAD_CLASS, "mt-1.5 max-w-[720px]")}>
                  {description}
                </p>
              )}
            </div>
            {actions && (
              // Testid distinguishes these actions from the duplicate set in
              // StickyEntityBanner's compact scroll header, which stays
              // matchable by role locators even while inert (Playwright
              // ignores inert).
              <div
                data-testid="entity-banner-actions"
                className="flex shrink-0 flex-wrap items-center gap-2"
              >
                {actions}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
