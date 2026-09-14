export type ResearchToolName = "webSearch" | "getContents" | "researchNotes";

export type SearchResult = {
  url: string;
  title?: string;
  summary?: string;
  highlights?: string[];
};

export interface ResearchStepProps {
  toolCallId: string;
  toolName: ResearchToolName;
  state: string;
  args?: Record<string, unknown>;
  result?: Record<string, unknown>;
}
