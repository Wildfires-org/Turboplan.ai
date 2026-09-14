"use client";

import { useCallback, useState } from "react";

import {
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@wildfires-org/turboplan-utils";

export interface FieldFormValues {
  name: string;
  type: "text" | "list";
  isRequired: boolean;
  tooltip: string;
}

interface FieldFormProps {
  /** Current form values (controlled component) */
  values: FieldFormValues;
  /** Callback when any value changes */
  onValuesChange: (values: FieldFormValues) => void;
  isSubmitting?: boolean;
  idPrefix?: string;
  /** Warning message to show when type changes (e.g., for edit mode) */
  typeChangeWarning?: string | null;
}

export const defaultFieldFormValues: FieldFormValues = {
  name: "",
  type: "text",
  isRequired: false,
  tooltip: "",
};

export function FieldForm({
  values,
  onValuesChange,
  isSubmitting = false,
  idPrefix = "",
  typeChangeWarning,
}: FieldFormProps) {
  const updateValue = <K extends keyof FieldFormValues>(
    key: K,
    value: FieldFormValues[K],
  ) => {
    onValuesChange({ ...values, [key]: value });
  };

  const nameId = `${idPrefix}name`;
  const typeId = `${idPrefix}type`;
  const tooltipId = `${idPrefix}tooltip`;
  const requiredId = `${idPrefix}required`;

  return (
    <div className="grid gap-4 py-4">
      {/* Field Name */}
      <div className="grid gap-2">
        <Label htmlFor={nameId}>Field Name</Label>
        <Input
          id={nameId}
          value={values.name}
          onChange={(e) => updateValue("name", e.target.value)}
          placeholder="e.g., Status, Priority, Owner"
          disabled={isSubmitting}
        />
      </div>

      {/* Field Type */}
      <div className="grid gap-2">
        <Label htmlFor={typeId}>Field Type</Label>
        <Select
          value={values.type}
          onValueChange={(v) => updateValue("type", v as "text" | "list")}
          disabled={isSubmitting}
        >
          <SelectTrigger id={typeId}>
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="text">Text</SelectItem>
            <SelectItem value="list">List</SelectItem>
          </SelectContent>
        </Select>
        {typeChangeWarning && (
          <p className="text-sm text-amber-600">{typeChangeWarning}</p>
        )}
      </div>

      {/* Tooltip */}
      <div className="grid gap-2">
        <Label htmlFor={tooltipId}>Tooltip (optional)</Label>
        <Textarea
          id={tooltipId}
          value={values.tooltip}
          onChange={(e) => updateValue("tooltip", e.target.value)}
          placeholder="Add a helpful description for this field"
          rows={2}
          disabled={isSubmitting}
        />
      </div>

      {/* Required checkbox */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id={requiredId}
          checked={values.isRequired}
          onChange={(e) => updateValue("isRequired", e.target.checked)}
          disabled={isSubmitting}
          className="size-4 rounded border-input accent-primary"
        />
        <Label htmlFor={requiredId} className="font-normal cursor-pointer">
          Required field
        </Label>
      </div>
    </div>
  );
}

export function useFieldForm(initialValues?: Partial<FieldFormValues>) {
  const [values, setValues] = useState<FieldFormValues>({
    ...defaultFieldFormValues,
    ...initialValues,
  });

  const reset = useCallback((newValues?: Partial<FieldFormValues>) => {
    setValues({ ...defaultFieldFormValues, ...newValues });
  }, []);

  const isValid = values.name.trim().length > 0;

  return {
    values,
    setValues,
    reset,
    isValid,
  };
}
