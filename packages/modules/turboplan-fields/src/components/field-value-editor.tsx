"use client";

import { useRef, useState } from "react";

import { Plus } from "lucide-react";

import type { ProjectField } from "@wildfires-org/turboplan-db";
import { Input } from "@wildfires-org/turboplan-utils";

interface FieldValueEditorProps {
  field: ProjectField;
  onValueChange: (values: string[]) => Promise<void>;
  disabled?: boolean;
}

/** Shared input component for both text and multi-select field values */
function ValueInput({
  initialValue,
  onSave,
  disabled,
  className,
}: {
  initialValue: string;
  onSave: (value: string) => Promise<void>;
  disabled: boolean;
  className: string;
}) {
  const [localValue, setLocalValue] = useState(initialValue);
  const [isSaving, setIsSaving] = useState(false);

  const handleBlur = async () => {
    const trimmedValue = localValue.trim();
    const trimmedInitial = initialValue.trim();

    // Only save if the value has actually changed
    if (trimmedValue === trimmedInitial) return;
    if (isSaving) return;

    setIsSaving(true);
    try {
      await onSave(trimmedValue);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Input
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={handleBlur}
      placeholder="Enter value..."
      className={className}
      disabled={disabled || isSaving}
    />
  );
}

export function FieldValueEditor({
  field,
  onValueChange,
  disabled = false,
}: FieldValueEditorProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [newOptionValue, setNewOptionValue] = useState("");
  const [isAddingOption, setIsAddingOption] = useState(false);
  const newOptionInputRef = useRef<HTMLInputElement>(null);

  const handleTextSave = async (value: string) => {
    await onValueChange(value ? [value] : []);
  };

  const handleMultiSelectValueSave = async (index: number, value: string) => {
    const currentValues = [...(field.values || [])];
    if (value) {
      currentValues[index] = value;
    } else {
      // Remove empty values
      currentValues.splice(index, 1);
    }
    await onValueChange(currentValues);
  };

  const handleAddOption = async () => {
    if (!newOptionValue.trim() || isSaving) return;
    const currentValues = [...(field.values || [])];
    currentValues.push(newOptionValue.trim());
    setIsSaving(true);
    try {
      await onValueChange(currentValues);
      setNewOptionValue("");
      setIsAddingOption(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleNewOptionKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddOption();
    } else if (e.key === "Escape") {
      setIsAddingOption(false);
      setNewOptionValue("");
    }
  };

  /** Ghost input: plain text until hover/focus reveals the editable affordance. */
  const inputClassName =
    "h-8 w-full rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm text-gray-900 shadow-none transition-[background-color,box-shadow] placeholder:text-gray-500 hover:bg-white/80 focus:bg-white focus:shadow-[inset_0_2px_6px_rgba(15,23,42,0.10),inset_0_1px_2px_rgba(15,23,42,0.08)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-brand-700/40 dark:text-gray-100";

  // Text field - always show input
  if (field.type === "text") {
    return (
      <ValueInput
        key={field.id}
        initialValue={field.values[0] || ""}
        onSave={handleTextSave}
        disabled={disabled}
        className={inputClassName}
      />
    );
  }

  // List field - stacked inputs with add option
  if (field.type === "list") {
    const values = field.values || [];

    return (
      <div className="flex flex-col gap-1">
        {values.map((value, index) => (
          <ValueInput
            key={field.id + index}
            initialValue={value}
            onSave={(newValue) => handleMultiSelectValueSave(index, newValue)}
            disabled={disabled}
            className={inputClassName}
          />
        ))}

        {/* Add option — keep control mounted while disabled to avoid layout shift */}
        {isAddingOption ? (
          <Input
            ref={newOptionInputRef}
            value={newOptionValue}
            onChange={(e) => setNewOptionValue(e.target.value)}
            onKeyDown={handleNewOptionKeyDown}
            onBlur={() => {
              if (disabled || isSaving) return;
              if (newOptionValue.trim()) {
                handleAddOption();
              } else {
                setIsAddingOption(false);
              }
            }}
            placeholder="Enter value..."
            className={inputClassName}
            disabled={isSaving || disabled}
            autoFocus={!disabled && !isSaving}
          />
        ) : (
          <button
            type="button"
            disabled={disabled || isSaving}
            onClick={() => {
              if (disabled || isSaving) return;
              setIsAddingOption(true);
              setTimeout(() => newOptionInputRef.current?.focus(), 0);
            }}
            className="flex h-8 w-fit items-center gap-1 rounded-lg px-2 text-sm font-medium text-brand-800 transition-colors hover:bg-white/80 hover:text-brand-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="size-4" />
            Add option
          </button>
        )}
      </div>
    );
  }

  return null;
}
