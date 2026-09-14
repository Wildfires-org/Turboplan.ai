import type { FieldChange, FieldDefinition } from "../types";

const isEqual = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;

  // Handle Date comparison
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }
  if (a instanceof Date) {
    return a.getTime() === new Date(b as string).getTime();
  }
  if (b instanceof Date) {
    return new Date(a as string).getTime() === b.getTime();
  }

  // Handle arrays and objects via JSON comparison
  if (typeof a === "object" || typeof b === "object") {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  return false;
};

/**
 * Computes field-level changes between two objects based on field definitions.
 * Returns an array of FieldChange objects for fields that differ.
 */
export const computeChanges = (
  previousObj: Record<string, unknown> | null,
  newObj: Record<string, unknown> | null,
  fieldDefs: FieldDefinition[],
): FieldChange[] => {
  const changes: FieldChange[] = [];

  for (const { field, valueType } of fieldDefs) {
    const previousValue = previousObj?.[field] ?? null;
    const newValue = newObj?.[field] ?? null;

    if (!isEqual(previousValue, newValue)) {
      changes.push({ field, previousValue, newValue, valueType });
    }
  }

  return changes;
};
