import { cn, generateInitialsFromName } from "@wildfires-org/turboplan-utils";

interface SidebarInitialsBadgeProps {
  name: string;
  className?: string;
}

export function SidebarInitialsBadge({
  name,
  className,
}: SidebarInitialsBadgeProps) {
  return (
    <span
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded text-[10px] font-semibold text-white bg-emerald-400",
        className,
      )}
    >
      {generateInitialsFromName(name)}
    </span>
  );
}
