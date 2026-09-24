"use client";

import { Children, type ReactNode } from "react";

import { cn } from "@wildfires-org/turboplan-utils";

interface FieldsListLayoutProps {
  children: ReactNode;
  className?: string;
  variant?: "card" | "bordered";
  footer?: ReactNode;
}

interface FieldsFieldItemProps {
  children: ReactNode;
  className?: string;
  /** When true, reserve narrower right padding for the kebab menu column */
  withActions?: boolean;
}

interface FieldsListRowProps {
  children: ReactNode;
  className?: string;
}

/**
 * Field table that splits into two side-by-side columns at `lg` to use the available
 * width (stacks to one column below). Rows are split column-major (first half left,
 * rest right). Each column is its own bordered table with hairline `divide-y` row
 * separators. The optional `footer` (e.g. a "load more" control) sits below the table.
 */
export function FieldsListLayout({
  children,
  className,
  footer,
}: FieldsListLayoutProps) {
  const items = Children.toArray(children);
  const mid = Math.ceil(items.length / 2);
  const columns =
    items.length > 1 ? [items.slice(0, mid), items.slice(mid)] : [items];
  const isTwoColumn = columns.length === 2;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div
        className={cn(
          "grid grid-cols-1 items-start gap-3",
          isTwoColumn && "lg:grid-cols-2 lg:gap-4",
        )}
      >
        {columns.map((column, index) => (
          <div
            key={index === 0 ? "left" : "right"}
            className="divide-y divide-slate-900/[0.06] overflow-hidden rounded-xl border border-white/90 bg-white/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.95)] dark:divide-white/10 dark:border-white/10 dark:bg-slate-900/40"
          >
            {column}
          </div>
        ))}
      </div>
      {footer}
    </div>
  );
}

/** One field row (label + value + optional menu). Hover reveals row tint + actions. */
export function FieldsFieldItem({
  children,
  className,
  withActions = false,
}: FieldsFieldItemProps) {
  return (
    <div
      className={cn(
        "group flex min-w-0 items-center gap-4 py-2 pl-4 transition-colors hover:bg-white/80 dark:hover:bg-white/5",
        withActions ? "pr-2" : "pr-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** @deprecated Prefer FieldsFieldItem */
export function FieldsListRow({ children, className }: FieldsListRowProps) {
  return <FieldsFieldItem className={className}>{children}</FieldsFieldItem>;
}

/** @deprecated Prefer FieldsFieldItem with withActions */
export function FieldsListRowWithActions({
  children,
  className,
}: FieldsListRowProps) {
  return (
    <FieldsFieldItem withActions className={className}>
      {children}
    </FieldsFieldItem>
  );
}
