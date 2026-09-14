"use client";

import type { HTMLAttributes } from "react";

import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@wildfires-org/turboplan-utils";

export const sectionItemSurfaceVariants = cva(
  "bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 rounded-lg px-4 py-3 shadow-sm hover:shadow transition-shadow",
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
