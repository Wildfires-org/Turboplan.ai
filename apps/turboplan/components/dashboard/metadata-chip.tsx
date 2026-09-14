import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type MetadataChipProps = {
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
};

export function MetadataChip({
  icon: Icon,
  children,
  className,
}: MetadataChipProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded border border-gray-100 bg-gray-50 px-1.5 py-0.5",
        className,
      )}
    >
      {Icon && <Icon className="size-3.5 text-gray-500" />}
      <span className="text-[10px] leading-4 text-gray-500">{children}</span>
    </div>
  );
}
