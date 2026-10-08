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
      data-sidebar-keep=""
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-900/[0.06] text-[10px] font-semibold",
        className,
      )}
    >
      {generateInitialsFromName(name)}
    </span>
  );
}
