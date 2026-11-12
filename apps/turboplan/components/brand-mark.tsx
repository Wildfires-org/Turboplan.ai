import type { LucideIcon } from "lucide-react";
import Image from "next/image";

import { brand } from "@/lib/brand";
import { cn } from "@/lib/utils";

type BrandMarkBadgeTone = "brand" | "success" | "error";

const BADGE_TONE_CLASS: Record<BrandMarkBadgeTone, string> = {
  brand: "bg-brand-500 text-white",
  success: "bg-brandAlt-500 text-white",
  error: "bg-error-600 text-white",
};

interface BrandMarkProps {
  /** Rendered width and height in pixels. */
  size?: number;
  /** Small status icon on the mark's lower-right corner. */
  badge?: { icon: LucideIcon; tone: BrandMarkBadgeTone };
  /** Gentle pulse while something is in progress. */
  pulse?: boolean;
  className?: string;
}

/**
 * The logo mark as a page illustration (auth, verify, signup and error
 * screens). Decorative: the heading next to it says what the state is.
 */
export const BrandMark = ({
  size = 72,
  badge,
  pulse = false,
  className,
}: BrandMarkProps) => {
  const BadgeIcon = badge?.icon;

  return (
    <div
      aria-hidden
      className={cn("relative inline-flex shrink-0", className)}
      style={{ width: size, height: size }}
    >
      <Image
        src={brand.logo}
        alt=""
        width={size}
        height={size}
        priority
        draggable={false}
        className={cn(
          "size-full select-none",
          pulse && "animate-pulse motion-reduce:animate-none",
        )}
      />
      {badge && BadgeIcon && (
        <span
          className={cn(
            "absolute -bottom-1 -right-1 flex size-7 items-center justify-center rounded-full ring-[3px] ring-white",
            BADGE_TONE_CLASS[badge.tone],
          )}
        >
          <BadgeIcon className="size-4" strokeWidth={2.5} />
        </span>
      )}
    </div>
  );
};

/**
 * Logo mark and app name in the top-left corner of the full-page auth, signup,
 * loading and error screens. Same type as the sidebar wordmark.
 */
export const BrandHeader = () => {
  return (
    <div className="absolute left-6 top-6 flex items-center gap-2 sm:left-[116px] sm:top-[63px]">
      <Image
        src={brand.logo}
        alt=""
        width={32}
        height={32}
        priority
        draggable={false}
        className="size-8 shrink-0 select-none"
      />
      <span className="text-lg font-semibold text-foreground">
        {brand.name}
      </span>
    </div>
  );
};
