import type { LucideIcon } from "lucide-react";

import { CHIP_BASE_CLASS, CHIP_TONE_CLASS } from "@/lib/glass";
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
    <span
      className={cn(
        CHIP_BASE_CLASS,
        CHIP_TONE_CLASS.neutral,
        "font-normal",
        className,
      )}
    >
      {Icon && <Icon aria-hidden />}
      <span>{children}</span>
    </span>
  );
}
