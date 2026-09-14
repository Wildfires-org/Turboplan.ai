"use client";

import { useEffect, useRef, useState } from "react";

import Image from "next/image";

import { cn } from "@/lib/utils";
import { EntityBanner } from "./entity-banner";

type StickyEntityBannerProps = {
  coverImageUrl?: string | null;
  logoUrl?: string | null;
  title: string;
  description?: string | null;
  actions?: React.ReactNode;
  className?: string;
};

export function StickyEntityBanner({
  coverImageUrl,
  logoUrl,
  title,
  description,
  actions,
  className,
}: StickyEntityBannerProps) {
  const bannerRef = useRef<HTMLDivElement>(null);
  const [isSticky, setIsSticky] = useState(false);

  // Blank/whitespace strings are truthy but crash next/image; normalize them so
  // a cleared or malformed logo/cover just falls back instead of throwing.
  const safeLogoUrl = logoUrl?.trim() || null;
  const safeCoverImageUrl =
    coverImageUrl?.trim() || "/images/banner-placeholder.png";

  useEffect(() => {
    const el = bannerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsSticky(!entry.isIntersecting);
      },
      { threshold: 0, rootMargin: "-64px 0px 0px 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      {/* Full banner */}
      <div ref={bannerRef} className={className}>
        <EntityBanner
          coverImageUrl={coverImageUrl}
          logoUrl={logoUrl}
          title={title}
          description={description}
          actions={actions}
        />
      </div>

      {/* Compact sticky header — h-0 prevents layout shift */}
      <div className="sticky top-16 z-[25] h-0 w-full">
        <div
          // While hidden the compact header is only faded out (opacity-0), so
          // without `inert` its duplicated action buttons stay focusable and
          // exposed to the accessibility tree alongside the full banner's.
          inert={!isSticky}
          className={cn(
            "w-full transition-all duration-200",
            isSticky
              ? "translate-y-0 opacity-100"
              : "-translate-y-full opacity-0 pointer-events-none",
          )}
        >
          <div className="relative w-full overflow-hidden border-b border-gray-200 bg-white">
            {/* Background cover image with gradient */}
            <div
              className="absolute inset-0 bg-cover bg-center opacity-30"
              style={{
                backgroundImage: `url(${safeCoverImageUrl})`,
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-white via-white/80 to-transparent" />

            <div className="relative flex items-center gap-3 px-8 py-3">
              {/* Logo */}
              {safeLogoUrl && (
                <div className="flex size-[30px] shrink-0 items-center justify-center rounded border border-gray-50 bg-white shadow-sm">
                  <Image
                    src={safeLogoUrl}
                    alt=""
                    width={22}
                    height={22}
                    className="object-contain"
                  />
                </div>
              )}

              {/* Title */}
              <h2 className="flex-1 text-[18px] font-medium leading-[20px] text-foreground">
                {title}
              </h2>

              {/* Actions */}
              {actions && (
                <div className="flex items-center gap-3">{actions}</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
