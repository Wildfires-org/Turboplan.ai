"use client";

import type { ReactNode } from "react";

import { cva } from "class-variance-authority";

import { Checkbox, cn } from "@wildfires-org/turboplan-utils";

export type SectionTone = "purple" | "blue" | "emerald" | "indigo" | "amber";

// Every section is the same white glass card; the tone only colors the
// section's icon and title so the panel reads as one surface.
const SECTION_ROOT_CLASS =
  "rounded-2xl border border-white/90 bg-white/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_10px_30px_-18px_rgba(21,102,71,0.25)] dark:border-white/10 dark:bg-slate-950/60";

const sectionTitleVariants = cva(
  "text-sm font-medium tracking-[-0.01em] truncate",
  {
    variants: {
      tone: {
        purple: "text-brand-800 dark:text-brand-300",
        blue: "text-brand-800 dark:text-brand-300",
        emerald: "text-brand-800 dark:text-brand-300",
        indigo: "text-brand-800 dark:text-brand-300",
        amber: "text-brand-800 dark:text-brand-300",
      },
    },
  },
);

const sectionIconVariants = cva("size-4 shrink-0", {
  variants: {
    tone: {
      purple: "text-brand-800 dark:text-brand-300",
      blue: "text-brand-800 dark:text-brand-300",
      emerald: "text-brand-800 dark:text-brand-300",
      indigo: "text-brand-800 dark:text-brand-300",
      amber: "text-brand-800 dark:text-brand-300",
    },
  },
});

type ResearchSectionRootProps = {
  tone: SectionTone;
  children: ReactNode;
  className?: string;
};

type ResearchSectionHeaderProps = {
  tone: SectionTone;
  icon: ReactNode;
  title: string;
  count?: number | string;
  actions?: ReactNode;
};

type ResearchSectionBodyProps = {
  children: ReactNode;
  className?: string;
};

type SelectAllControlProps = {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
};

type SelectionIndicatorProps = {
  selectedCount: number;
  variant?: "default" | "on-green";
};

export function ResearchSectionRoot({
  className,
  children,
}: ResearchSectionRootProps) {
  return <div className={cn(SECTION_ROOT_CLASS, className)}>{children}</div>;
}

export function ResearchSectionHeader({
  tone,
  icon,
  title,
  count,
  actions,
}: ResearchSectionHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-4 gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <span className={sectionIconVariants({ tone })}>{icon}</span>
        <h3 className={sectionTitleVariants({ tone })}>
          {title}
          {count != null && count !== "" ? ` (${count})` : ""}
        </h3>
      </div>
      {actions}
    </div>
  );
}

export function ResearchSectionBody({
  children,
  className,
}: ResearchSectionBodyProps) {
  return <div className={cn("flex flex-col gap-2", className)}>{children}</div>;
}

export function SelectAllControl({
  checked,
  onChange,
  disabled,
}: SelectAllControlProps) {
  return (
    <label
      className={cn(
        "inline-flex shrink-0 items-center gap-2 whitespace-nowrap",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
      )}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={onChange}
        disabled={disabled}
        aria-label="Select all items"
        className="rounded-[4px] border-gray-550 data-[state=checked]:border-brand-800 data-[state=checked]:bg-brand-800 data-[state=checked]:text-white focus-visible:ring-brand-700/30"
      />
      <span className="text-[12px] font-medium leading-4 tracking-[0.12px] text-foreground">
        Select all
      </span>
    </label>
  );
}

export function SelectionIndicator({
  selectedCount,
  variant = "default",
}: SelectionIndicatorProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center size-5 rounded-full text-xs font-medium",
        variant === "on-green"
          ? "bg-white/70 text-neutral-900"
          : "bg-brand-800 text-white",
      )}
    >
      {selectedCount}
    </span>
  );
}
