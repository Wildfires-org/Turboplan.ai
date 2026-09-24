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
    coverImageUrl?.trim() || "/images/banner-placeholder.jpg";

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
            "w-full transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none",
            isSticky
              ? "translate-y-0 opacity-100"
              : "-translate-y-full opacity-0 pointer-events-none",
          )}
        >
          <div className="relative w-full overflow-hidden border-b border-white/80 bg-white/75 shadow-[0_10px_30px_-18px_rgba(15,23,42,0.25)] backdrop-blur-xl backdrop-saturate-150 dark:border-white/10 dark:bg-slate-950/75">
            {/* Faint cover tint behind the compact header */}
            <div
              className="absolute inset-0 bg-cover bg-center opacity-20"
              style={{
                backgroundImage: `url(${safeCoverImageUrl})`,
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-white via-white/85 to-white/40 dark:from-slate-950 dark:via-slate-950/85 dark:to-slate-950/40" />

            <div className="relative flex h-14 items-center gap-3 px-4 sm:px-8">
              {/* Logo */}
              {safeLogoUrl && (
                <div className="flex size-[30px] shrink-0 items-center justify-center rounded-lg border border-white bg-white shadow-sm">
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
              <h2 className="min-w-0 flex-1 truncate text-[17px] font-medium leading-[20px] tracking-[-0.02em] text-foreground">
                {title}
              </h2>

              {/* Actions */}
              {actions && (
                <div className="flex shrink-0 items-center gap-2">
                  {actions}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
