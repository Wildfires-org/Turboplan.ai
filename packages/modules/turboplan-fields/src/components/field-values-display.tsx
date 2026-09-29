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
      <span className="block whitespace-pre-wrap break-words text-sm leading-5 text-gray-900 dark:text-gray-100">
        {values[0] || <span className="text-gray-500">—</span>}
      </span>
    );
  }

  if (values.length === 0) {
    return <span className="text-sm text-gray-500">—</span>;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {values.map((value, index) => (
        <span
          key={`${fieldId}-${index}`}
          className="inline-flex items-center rounded-full bg-slate-900/[0.04] px-2 py-0.5 text-xs font-medium text-gray-800 ring-1 ring-inset ring-slate-900/[0.06]"
        >
          {value}
        </span>
      ))}
    </div>
  );
}
