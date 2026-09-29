import { Eye, MoreVertical } from "lucide-react";

import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

// Staggered fade-up row.
export function Reveal({
  children,
  index,
  reduce,
  className,
}: {
  children: React.ReactNode;
  index: number;
  reduce: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn("showcase-reveal-row", className)}
      style={
        reduce
          ? undefined
          : {
              opacity: 0,
              animation: "showcase-reveal 0.4s var(--ease-out-expo) both",
              // 60ms — inside the standards' 30–80ms stagger band.
              animationDelay: `${index * 60}ms`,
            }
      }
    >
      {children}
    </div>
  );
}

// Project progress bar: green fill (bg-brandAlt-400 ≈ #5fa98d) on a light track,
// mirroring ui/project-progress.tsx. Re-animates on activation.
export function ProgressBar({ pct, reduce }: { pct: number; reduce: boolean }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-egray-100">
      <div
        className="showcase-progress-fill h-full origin-left rounded-full bg-brandAlt-400"
        style={{
          width: `${pct}%`,
          transform: reduce ? "scaleX(1)" : "scaleX(0)",
          animation: reduce
            ? "none"
            : "showcase-progress 1s var(--ease-out-expo) 0.35s both",
        }}
      />
    </div>
  );
}

// Dashboard "section card" shell — icon + bold title + inline gray subtitle,
// with an optional action link plus eye / overflow controls on the right
// (apps/turboplan/components/section-card.tsx).
export function SectionCard({
  icon,
  title,
  subtitle,
  action,
  children,
  className,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-2xl border border-egray-100 bg-white",
        className,
      )}
    >
      <div className="flex items-center gap-2 border-b border-egray-100 px-4 py-3">
        <span className="flex items-center text-neutral-black">{icon}</span>
        <h3 className="shrink-0 font-heading text-[14px] font-bold leading-[21px] text-neutral-black">
          {title}
        </h3>
        {subtitle && (
          <span className="truncate font-inter text-[11.5px] font-medium text-egray-500">
            {subtitle}
          </span>
        )}
        <span className="ml-auto flex shrink-0 items-center gap-2 text-egray-400">
          {action}
          <Eye className="size-4" />
          <MoreVertical className="size-4" />
        </span>
      </div>
      <div className="min-h-0 flex-1 p-4">{children}</div>
    </div>
  );
}

// Placeholders the agent leaves for the user to fill — highlighted yellow in
// the real document artifact preview.
export function Insert({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-sm bg-[#FEF3C7] px-1 py-0.5 text-[#854D0E]">
      {children}
    </span>
  );
}

// Compact outline pill button used in the artifact preview header.
export function DocAction({
  icon,
  label,
  trailing,
  className,
}: {
  icon: React.ReactNode;
  label?: string;
  trailing?: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex items-center gap-1 rounded-md border border-egray-200 bg-white px-2 py-1 font-inter text-[11px] font-medium text-egray-700",
        className,
      )}
    >
      {icon}
      {label}
      {trailing}
    </span>
  );
}
