import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

interface ProjectSubpageHeaderProps {
  title: string;
  backHref: string;
  /** Skip the bottom border (when embedded inside another bordered container) */
  noBorder?: boolean;
}

export function ProjectSubpageHeader({
  title,
  backHref,
  noBorder,
}: ProjectSubpageHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-4",
        !noBorder && "border-b border-gray-200 pb-4",
      )}
    >
      <Link
        href={backHref}
        className="text-gray-400 hover:text-gray-600 transition-colors"
      >
        <ArrowLeft className="size-[18px]" />
      </Link>
      <h2 className="text-base font-semibold text-gray-800">{title}</h2>
    </div>
  );
}
