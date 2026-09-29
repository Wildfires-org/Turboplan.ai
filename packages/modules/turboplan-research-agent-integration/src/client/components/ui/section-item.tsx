"use client";

import type { HTMLAttributes } from "react";

import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@wildfires-org/turboplan-utils";

export const sectionItemSurfaceVariants = cva(
  "rounded-xl bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.04] transition-shadow hover:shadow-[0_4px_12px_-6px_rgba(15,23,42,0.15)] dark:bg-slate-900 dark:ring-white/10",
  {
    variants: {
      layout: {
        default: "",
        row: "flex items-center gap-3",
      },
    },
    defaultVariants: {
      layout: "default",
    },
  },
);

type SectionItemCardProps = HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof sectionItemSurfaceVariants>;

export function SectionItemCard({
  layout,
  className,
  children,
  ...props
}: SectionItemCardProps) {
  return (
    <div
      className={cn(sectionItemSurfaceVariants({ layout }), className)}
      {...props}
    >
      {children}
    </div>
  );
}
