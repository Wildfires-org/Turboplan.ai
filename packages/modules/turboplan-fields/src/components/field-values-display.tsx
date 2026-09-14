"use client";

interface FieldValuesDisplayProps {
  type: "text" | "list";
  values: string[];
  fieldId: string;
}

export function FieldValuesDisplay({
  type,
  values,
  fieldId,
}: FieldValuesDisplayProps) {
  if (type === "text") {
    return (
      <span className="block truncate text-sm font-medium text-foreground">
        {values[0] || (
          <span className="font-normal text-muted-foreground">—</span>
        )}
      </span>
    );
  }

  if (values.length === 0) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {values.map((value, index) => (
        <span
          key={`${fieldId}-${index}`}
          className="inline-flex items-center rounded bg-muted px-2 py-0.5 text-xs font-medium text-foreground"
        >
          {value}
        </span>
      ))}
    </div>
  );
}
