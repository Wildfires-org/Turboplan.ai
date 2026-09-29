import type { ReactNode } from "react";

import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  icon: LucideIcon;
  eyebrow: string;
  title: ReactNode;
  lead?: ReactNode;
  align?: "center" | "start";
  className?: string;
}

// Shared homepage type scale. H2 sits one step below the hero H1 (36/48/60).
export const SECTION_TITLE_CLASS =
  "font-heading text-[32px] font-normal leading-[1.15] tracking-[-0.04em] text-balance text-egray-900 md:text-[40px] lg:text-[48px]";

export const SECTION_LEAD_CLASS =
  "font-inter text-body-md font-medium text-egray-700 md:text-body-lg";

// Eyebrow chip. Exported for the hero, which animates its eyebrow.
export const EYEBROW_CLASS =
  "glass inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 font-heading text-[12px] font-medium uppercase leading-[16px] tracking-[0.08em] text-brand-800";

export const EYEBROW_ICON_CLASS = "size-3.5";

// Eyebrow → H2 → lead spacing.
export const HEADER_STACK_CLASS = "flex flex-col gap-[18px]";

export function Eyebrow({
  icon: Icon,
  label,
}: {
  icon: LucideIcon;
  label: string;
}) {
  return (
    <span className={EYEBROW_CLASS}>
      <Icon className={EYEBROW_ICON_CLASS} />
      {label}
    </span>
  );
}

export function SectionHeader({
  icon,
  eyebrow,
  title,
  lead,
  align = "center",
  className,
}: SectionHeaderProps) {
  const isCentered = align === "center";

  return (
    <div
      className={cn(
        HEADER_STACK_CLASS,
        isCentered
          ? "mx-auto max-w-[760px] items-center text-center"
          : "items-start",
        className,
      )}
    >
      <Eyebrow icon={icon} label={eyebrow} />
      <h2 className={SECTION_TITLE_CLASS}>{title}</h2>
      {lead ? (
        <p className={cn(SECTION_LEAD_CLASS, isCentered && "max-w-[640px]")}>
          {lead}
        </p>
      ) : null}
    </div>
  );
}
