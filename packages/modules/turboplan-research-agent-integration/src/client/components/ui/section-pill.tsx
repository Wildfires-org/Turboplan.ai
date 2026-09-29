"use client";

import type { HTMLAttributes, ReactNode } from "react";

import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@wildfires-org/turboplan-utils";

const sectionPillVariants = cva(
  "h-5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] leading-4",
  {
    variants: {
      tone: {
        neutral:
          "bg-slate-900/[0.04] text-gray-550 ring-1 ring-inset ring-slate-900/[0.06] dark:bg-white/10 dark:text-slate-300",
        warning:
          "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-700/15 dark:bg-amber-950/30 dark:text-amber-300",
        secondary:
          "bg-brand-50 text-brand-900 ring-1 ring-inset ring-brand-800/15",
      },
      weight: {
        normal: "font-normal",
        strong: "font-semibold",
      },
      align: {
        start: "",
        center: "justify-center",
      },
    },
    defaultVariants: {
      tone: "neutral",
      weight: "normal",
      align: "start",
    },
  },
);

type SectionPillProps = HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof sectionPillVariants> & {
    icon?: ReactNode;
  };

export function SectionPill({
  tone,
  weight,
  align,
  icon,
  className,
  children,
  ...props
}: SectionPillProps) {
  return (
    <span
      className={cn(sectionPillVariants({ tone, weight, align }), className)}
      {...props}
    >
      {icon}
      {children}
    </span>
  );
}
