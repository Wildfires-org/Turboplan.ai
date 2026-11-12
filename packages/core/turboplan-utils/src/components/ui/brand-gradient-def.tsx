"use client";

import { useId } from "react";

import type { LucideIcon, LucideProps } from "lucide-react";

// Wildfires.org orange, light to deep: the `bg-brand-special` accent and the
// stroke of `BrandGradientIcon`.
export const BRAND_GRADIENT = {
  angle: "115.33deg",
  stops: [
    { offset: "0%", color: "#FFB366" },
    { offset: "54%", color: "#FF8000" },
    { offset: "100%", color: "#C25E00" },
  ],
} as const;

export const BRAND_GRADIENT_CSS = `linear-gradient(${BRAND_GRADIENT.angle}, ${BRAND_GRADIENT.stops.map((s) => `${s.color} ${s.offset}`).join(", ")})`;

interface BrandGradientIconProps extends LucideProps {
  icon: LucideIcon;
}

export const BrandGradientIcon = ({
  icon: Icon,
  ...props
}: BrandGradientIconProps) => {
  const id = useId();
  const gradientId = `brand-gradient-${id}`;

  return (
    <>
      <svg className="absolute size-0" aria-hidden="true">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="60%">
            {BRAND_GRADIENT.stops.map((stop) => (
              <stop
                key={stop.offset}
                offset={stop.offset}
                stopColor={stop.color}
              />
            ))}
          </linearGradient>
        </defs>
      </svg>
      <Icon {...props} stroke={`url(#${gradientId})`} />
    </>
  );
};
