"use client";

import type { ReactNode } from "react";

import { cva } from "class-variance-authority";

import { Checkbox, cn } from "@wildfires-org/turboplan-utils";

export type SectionTone = "purple" | "blue" | "emerald" | "indigo" | "amber";

const sectionRootVariants = cva("rounded-xl border p-4", {
  variants: {
    tone: {
      purple:
        "bg-purple-50/60 dark:bg-purple-950/20 border-purple-100 dark:border-purple-800/30",
      blue: "bg-blue-50/60 dark:bg-blue-950/20 border-blue-100 dark:border-blue-800/30",
      emerald:
        "bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-800/30",
      indigo:
        "bg-indigo-50/60 dark:bg-indigo-950/20 border-indigo-100 dark:border-indigo-800/30",
      amber:
        "bg-amber-50/60 dark:bg-amber-950/20 border-amber-100 dark:border-amber-800/30",
    },
  },
});

const sectionTitleVariants = cva("text-sm font-bold truncate", {
  variants: {
    tone: {
      purple: "text-purple-700 dark:text-purple-300",
      blue: "text-blue-700 dark:text-blue-300",
      emerald: "text-emerald-700 dark:text-emerald-300",
      indigo: "text-indigo-700 dark:text-indigo-300",
      amber: "text-amber-700 dark:text-amber-300",
    },
  },
});

const sectionIconVariants = cva("size-4 shrink-0", {
  variants: {
    tone: {
      purple: "text-purple-600 dark:text-purple-400",
      blue: "text-blue-600 dark:text-blue-400",
      emerald: "text-emerald-600 dark:text-emerald-400",
      indigo: "text-indigo-700 dark:text-indigo-400",
      amber: "text-amber-600 dark:text-amber-400",
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
  tone,
  className,
  children,
}: ResearchSectionRootProps) {
  return (
    <div className={cn(sectionRootVariants({ tone }), className)}>
      {children}
    </div>
  );
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
        className="rounded-[4px] border-[#6B7280] data-[state=checked]:border-black data-[state=checked]:bg-black data-[state=checked]:text-white focus-visible:ring-black/25"
      />
      <span className="text-[12px] font-semibold leading-4 tracking-[0.12px] text-[#262626]">
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
