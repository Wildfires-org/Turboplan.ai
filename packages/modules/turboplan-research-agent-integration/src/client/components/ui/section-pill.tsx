"use client";

import type { HTMLAttributes, ReactNode } from "react";

import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@wildfires-org/turboplan-utils";

const sectionPillVariants = cva(
  "h-5 inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] leading-4",
  {
    variants: {
      tone: {
        neutral:
          "bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400",
        warning:
          "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/50 text-amber-600 dark:text-amber-400",
        secondary: "bg-secondary text-secondary-foreground border-transparent",
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
