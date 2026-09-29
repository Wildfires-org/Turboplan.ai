"use client";

import { cn } from "@wildfires-org/turboplan-utils";

import { FieldLabel } from "./field-label";
import { FieldValuesDisplay } from "./field-values-display";
import { FieldsFieldItem, FieldsListLayout } from "./fields-list-layout";

const fieldLabelColumnClassName = "w-36 shrink-0 sm:w-44";

export interface ReadOnlyField {
  id: string;
  name: string;
  type: "text" | "list";
  isRequired: boolean;
  tooltip: string | null;
  order?: number;
  values: string[];
}

interface ReadOnlyFieldsRendererProps {
  fields: ReadOnlyField[];
  className?: string;
  variant?: "card" | "bordered";
  emptyTitle?: string;
  emptyMessage?: string;
}

export function ReadOnlyFieldsRenderer({
  fields,
  className,
  variant = "card",
  emptyTitle = "No Fields",
  emptyMessage = "This template doesn't have any custom fields defined yet.",
}: ReadOnlyFieldsRendererProps) {
  if (fields.length === 0) {
    return (
      <div
        className={cn(
          "border border-border p-6",
          variant === "card" ? "rounded-xl bg-card" : "rounded-lg",
          className,
        )}
      >
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <h3 className="mb-2 text-lg font-medium">{emptyTitle}</h3>
          <p className="max-w-md text-sm text-muted-foreground">
            {emptyMessage}
          </p>
        </div>
      </div>
    );
  }

  const sortedFields = [...fields].sort(
    (a, b) =>
      (a.order ?? Number.MAX_SAFE_INTEGER) -
      (b.order ?? Number.MAX_SAFE_INTEGER),
  );

  return (
    <FieldsListLayout variant={variant} className={className}>
      {sortedFields.map((field) => (
        <FieldsFieldItem
          key={field.id}
          className={variant === "card" ? "bg-card" : undefined}
        >
          <FieldLabel
            name={field.name}
            isRequired={field.isRequired}
            tooltip={field.tooltip}
            tooltipVariant="native"
            className={fieldLabelColumnClassName}
          />

          <div className="min-w-0 flex-1">
            <FieldValuesDisplay
              type={field.type}
              values={field.values}
              fieldId={field.id}
            />
          </div>
        </FieldsFieldItem>
      ))}
    </FieldsListLayout>
  );
}
