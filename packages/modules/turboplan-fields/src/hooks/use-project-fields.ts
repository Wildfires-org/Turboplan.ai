"use client";

import { useCallback } from "react";

import useSWR from "swr";
import useSWRMutation from "swr/mutation";

import { ApiClient, fetcher } from "@wildfires-org/turboplan-api-client";
import type { ProjectField } from "@wildfires-org/turboplan-db";

export type { ProjectField };

const apiClient = new ApiClient();

interface UseProjectFieldsConfig {
  projectId: string;
  enabled?: boolean;
}

interface FieldsResponse {
  fields: ProjectField[];
}

interface FieldResponse {
  field: ProjectField;
}

interface CreateFieldInput {
  name: string;
  type: "text" | "list";
  isRequired?: boolean;
  tooltip?: string;
  values?: string[];
}

interface UpdateFieldInput {
  name?: string;
  type?: "text" | "list";
  isRequired?: boolean;
  tooltip?: string | null;
  values?: string[];
}

async function createFieldFetcher(
  url: string,
  { arg }: { arg: CreateFieldInput },
): Promise<FieldResponse> {
  const { data, error } = await apiClient.post<FieldResponse>(url, arg);

  if (error) {
    throw new Error(error || "Failed to create field");
  }

  return data as FieldResponse;
}

async function updateFieldFetcher(
  url: string,
  { arg }: { arg: { fieldId: string; data: UpdateFieldInput } },
): Promise<FieldResponse> {
  const { data, error } = await apiClient.put<FieldResponse>(
    `${url}/${arg.fieldId}`,
    arg.data,
  );

  if (error) {
    throw new Error(error || "Failed to update field");
  }

  return data as FieldResponse;
}

async function deleteFieldFetcher(
  url: string,
  { arg }: { arg: { fieldId: string } },
): Promise<{ success: boolean }> {
  const { data, error } = await apiClient.delete<{ success: boolean }>(
    `${url}/${arg.fieldId}`,
  );

  if (error) {
    throw new Error(error || "Failed to delete field");
  }

  return data as { success: boolean };
}

/**
 * Hook for managing project fields
 *
 * Provides CRUD operations and optimistic updates for project fields.
 *
 * @example
 * ```tsx
 * const { fields, addField, updateField, deleteField, isLoading } =
 *   useProjectFields({ projectId: 'abc-123' });
 *
 * // Add a new field
 * await addField({ name: 'Status', type: 'list' });
 *
 * // Update field values
 * await updateField('field-id', { values: ['Active'] });
 *
 * // Delete a field
 * await deleteField('field-id');
 * ```
 */
export function useProjectFields({
  projectId,
  enabled = true,
}: UseProjectFieldsConfig) {
  const apiPath = `/api/projects/${projectId}/fields`;

  // Fetch project fields
  const {
    data: fieldsData,
    isLoading,
    error,
    mutate,
  } = useSWR<FieldsResponse>(enabled ? apiPath : null, fetcher);

  // Mutations
  const { trigger: triggerCreate, isMutating: isCreating } = useSWRMutation(
    apiPath,
    createFieldFetcher,
    {
      populateCache: false,
      revalidate: true,
    },
  );

  const { trigger: triggerUpdate, isMutating: isUpdating } = useSWRMutation(
    apiPath,
    updateFieldFetcher,
    {
      populateCache: false,
      revalidate: true,
    },
  );

  const { trigger: triggerDelete, isMutating: isDeleting } = useSWRMutation(
    apiPath,
    deleteFieldFetcher,
    {
      populateCache: false,
      revalidate: true,
    },
  );

  const fields = fieldsData?.fields || [];

  /**
   * Add a new field to the project
   */
  const addField = useCallback(
    async (input: CreateFieldInput) => {
      const currentFields = fields;

      // Optimistic update
      const now = new Date();
      const optimisticField: ProjectField = {
        id: crypto.randomUUID(),
        projectId,
        name: input.name,
        type: input.type,
        isRequired: input.isRequired ?? false,
        tooltip: input.tooltip ?? null,
        order: currentFields.length,
        values: input.values ?? [],
        createdAt: now,
        updatedAt: now,
      };

      try {
        await mutate(
          async () => {
            const result = await triggerCreate(input);
            return { fields: [...currentFields, result.field] };
          },
          {
            optimisticData: { fields: [...currentFields, optimisticField] },
            rollbackOnError: true,
            revalidate: true,
          },
        );
      } catch (error) {
        console.error("Failed to add field:", error);
        throw error;
      }
    },
    [fields, projectId, triggerCreate, mutate],
  );

  /**
   * Update an existing field
   */
  const updateField = useCallback(
    async (fieldId: string, data: UpdateFieldInput) => {
      const currentFields = fields;
      const fieldIndex = currentFields.findIndex((f) => f.id === fieldId);

      if (fieldIndex === -1) {
        throw new Error("Field not found");
      }

      // Optimistic update
      const updatedField: ProjectField = {
        ...currentFields[fieldIndex],
        ...data,
        tooltip:
          data.tooltip === null
            ? null
            : (data.tooltip ?? currentFields[fieldIndex].tooltip),
        updatedAt: new Date(),
      };
      const optimisticFields = [...currentFields];
      optimisticFields[fieldIndex] = updatedField;

      try {
        await mutate(
          async () => {
            const result = await triggerUpdate({ fieldId, data });
            const newFields = [...currentFields];
            newFields[fieldIndex] = result.field;
            return { fields: newFields };
          },
          {
            optimisticData: { fields: optimisticFields },
            rollbackOnError: true,
            revalidate: true,
          },
        );
      } catch (error) {
        console.error("Failed to update field:", error);
        throw error;
      }
    },
    [fields, triggerUpdate, mutate],
  );

  /**
   * Delete a field
   */
  const deleteField = useCallback(
    async (fieldId: string) => {
      const currentFields = fields;

      // Optimistic update - remove field and update order
      const optimisticFields = currentFields
        .filter((f) => f.id !== fieldId)
        .map((f, index) => ({ ...f, order: index }));

      try {
        await mutate(
          async () => {
            await triggerDelete({ fieldId });
            return { fields: optimisticFields };
          },
          {
            optimisticData: { fields: optimisticFields },
            rollbackOnError: true,
            revalidate: true,
          },
        );
      } catch (error) {
        console.error("Failed to delete field:", error);
        throw error;
      }
    },
    [fields, triggerDelete, mutate],
  );

  return {
    fields,
    addField,
    updateField,
    deleteField,
    isLoading,
    isCreating,
    isUpdating,
    isDeleting,
    isMutating: isCreating || isUpdating || isDeleting,
    error,
    mutate,
  };
}
