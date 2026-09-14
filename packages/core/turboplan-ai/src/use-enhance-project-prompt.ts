"use client";

import { useCallback, useState } from "react";

import { ApiClient } from "@wildfires-org/turboplan-api-client";
import { getServerUrl } from "@wildfires-org/turboplan-env";

export type EnhancePromptResult = {
  enhancedPrompt: string | null;
};

const apiClient = new ApiClient();

export const useEnhanceProjectPrompt = ({
  isPublic = false,
}: {
  isPublic?: boolean;
} = {}) => {
  const [isEnhancing, setIsEnhancing] = useState(false);

  const enhance = useCallback(
    async (prompt: string, missing?: string[]): Promise<string | null> => {
      const trimmed = prompt.trim();
      if (!trimmed) {
        return null;
      }

      setIsEnhancing(true);
      try {
        let result: EnhancePromptResult;

        if (isPublic) {
          const serverUrl = getServerUrl();
          const response = await fetch(
            `${serverUrl}/api/public/enhance-prompt`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                prompt: trimmed,
                missing: missing || [],
              }),
            },
          );
          result = response.ok
            ? await response.json()
            : { enhancedPrompt: null };
        } else {
          const { data, error } = await apiClient.post<EnhancePromptResult>(
            "/api/ai/enhance-prompt",
            {
              prompt: trimmed,
              missing: missing || [],
            },
          );
          result = error || !data ? { enhancedPrompt: null } : data;
        }

        return result.enhancedPrompt;
      } catch {
        return null;
      } finally {
        setIsEnhancing(false);
      }
    },
    [isPublic],
  );

  return { enhance, isEnhancing };
};
