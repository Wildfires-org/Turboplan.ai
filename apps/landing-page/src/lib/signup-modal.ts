import type { GenerateTitlesResponse } from "@/lib/generate-titles";

/** What the signup modal proposes to create, before the user edits it. */
export type ProposedTitles = {
  projectTitle: string;
  organizationName: string;
  officeName: string;
};

// Length of the prompt-based project name used until (or instead of) a
// generated one.
const FALLBACK_TITLE_LENGTH = 50;

/**
 * The names the signup modal shows: the generated ones when title generation
 * returned a project title, else the start of the prompt. Organization and
 * office are legitimately empty when the server finds no matching government
 * office, so only the project title falls back to the prompt.
 */
export const resolveProposedTitles = (
  description: string,
  titles?: GenerateTitlesResponse,
  fallbackOfficeName = "",
): ProposedTitles => {
  return {
    projectTitle:
      titles?.projectTitle ||
      description.trim().slice(0, FALLBACK_TITLE_LENGTH),
    organizationName: titles?.organizationName || "",
    officeName: titles?.officeTitle || fallbackOfficeName,
  };
};
