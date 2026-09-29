import type { ReactNode } from "react";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { GLASS_ICON_BUTTON_CLASS } from "@/lib/glass";
import { cn } from "@/lib/utils";

interface ProjectSubpageHeaderProps {
  title: string;
  backHref: string;
  /** Kept for callers embedding it in another container; the row has no
   * divider any more, so this is a no-op. */
  noBorder?: boolean;
  /** Right-aligned controls on the title row. */
  actions?: ReactNode;
  className?: string;
}

/** Back button + sub-view title (36px row). */
export function ProjectSubpageHeader({
  title,
  backHref,
  actions,
  className,
}: ProjectSubpageHeaderProps) {
  return (
    <div className={cn("flex min-h-9 flex-wrap items-center gap-3", className)}>
      <Link
        href={backHref}
        aria-label="Back to project overview"
        className={cn(GLASS_ICON_BUTTON_CLASS, "size-9")}
      >
        <ArrowLeft aria-hidden className="size-4" />
      </Link>
      <h2 className="min-w-0 flex-1 truncate text-[20px] font-medium leading-7 tracking-[-0.02em] text-foreground">
        {title}
      </h2>
      {actions && (
        <div className="flex w-full items-center gap-2 sm:w-auto sm:shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}
