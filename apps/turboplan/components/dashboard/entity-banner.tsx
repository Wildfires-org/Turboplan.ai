import Image from "next/image";

import { cn } from "@/lib/utils";

type EntityBannerProps = {
  coverImageUrl?: string | null;
  logoUrl?: string | null;
  title: string;
  description?: string | null;
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
    coverImageUrl?.trim() || "/images/banner-placeholder.png";

  return (
    <div className={cn("relative w-full", className)}>
      {/* Cover image */}
      <div className="relative h-[124px] w-full overflow-hidden">
        <Image
          src={safeCoverImageUrl}
          alt=""
          fill
          className="object-cover"
          sizes="100vw"
        />
      </div>

      {/* Logo overlapping bottom of cover — outside overflow-hidden */}
      {safeLogoUrl && (
        <div className="absolute left-8 top-[88px] z-10">
          <div className="flex size-[72px] items-center justify-center rounded-lg border-2 border-gray-50 bg-white shadow-[0px_2px_4px_rgba(0,0,0,0.1),0px_2px_6px_rgba(0,0,0,0.1)]">
            <Image
              src={safeLogoUrl}
              alt=""
              width={49}
              height={55}
              className="object-contain"
            />
          </div>
        </div>
      )}

      {/* Content below cover */}
      <div className="border-b border-gray-300 bg-white px-8 pb-5 pt-[52px]">
        <div className="flex items-end justify-between gap-3">
          <div className="flex-1">
            <h1 className="text-[24px] font-semibold leading-[32px] text-foreground">
              {title}
            </h1>
          </div>
          {actions && (
            // Testid distinguishes these actions from the duplicate set in
            // StickyEntityBanner's compact scroll header, which stays matchable
            // by role locators even while inert (Playwright ignores inert).
            <div
              data-testid="entity-banner-actions"
              className="flex items-center gap-3"
            >
              {actions}
            </div>
          )}
        </div>
        {description && (
          <p className="mt-3 text-[14px] leading-[20px] text-foreground">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}
