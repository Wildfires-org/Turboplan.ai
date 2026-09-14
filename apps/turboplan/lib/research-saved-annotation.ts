import type { UIMessage } from "ai";

export const RESEARCH_SAVED_TYPE = "research-saved" as const;

export type ResearchSavedAnnotation = {
  type: typeof RESEARCH_SAVED_TYPE;
  totalSaved: number;
  sections: Array<{
    sectionKey: string;
    savedCount: number;
    itemNames: string[];
  }>;
};

export const getResearchSavedData = (
  message: UIMessage,
): ResearchSavedAnnotation | null => {
  const part = message.parts?.find(
    (p) =>
      p.type === "data-research-saved" &&
      typeof (p as Record<string, unknown>).data === "object",
  );
  if (!part) {
    return null;
  }
  const data = (part as { data: Record<string, unknown> }).data;
  if (data?.type === RESEARCH_SAVED_TYPE) {
    return data as unknown as ResearchSavedAnnotation;
  }
  return null;
};
