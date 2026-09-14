"use client";

import { useCallback, useState } from "react";

import { ApiClient } from "@wildfires-org/turboplan-api-client";
import { getServerUrl } from "@wildfires-org/turboplan-env";

export type ValidatePromptResult = {
  valid: boolean;
  missing?: string[];
  feedback?: string;
};

const apiClient = new ApiClient();

export const useValidateProjectPrompt = ({
  isPublic = false,
}: {
  isPublic?: boolean;
} = {}) => {
  const [validation, setValidation] = useState<ValidatePromptResult | null>(
    null,
  );
  const [isValidating, setIsValidating] = useState(false);

  const validate = useCallback(
    async (prompt: string): Promise<ValidatePromptResult | null> => {
      const trimmed = prompt.trim();
      if (!trimmed) {
        setValidation(null);
        return null;
      }

      setIsValidating(true);
      try {
        let result: ValidatePromptResult;

        if (isPublic) {
          const serverUrl = getServerUrl();
          const response = await fetch(
            `${serverUrl}/api/public/validate-prompt`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ prompt: trimmed }),
            },
          );
          result = response.ok ? await response.json() : { valid: true };
        } else {
          const { data, error } = await apiClient.post<ValidatePromptResult>(
            "/api/ai/validate-prompt",
            { prompt: trimmed },
          );
          result = error || !data ? { valid: true } : data;
        }

        setValidation(result);
        return result;
      } catch {
        const fallback: ValidatePromptResult = { valid: true };
        setValidation(fallback);
        return fallback;
      } finally {
        setIsValidating(false);
      }
    },
    [isPublic],
  );

  const reset = useCallback(() => {
    setValidation(null);
  }, []);

  return { validate, isValidating, validation, reset };
};
