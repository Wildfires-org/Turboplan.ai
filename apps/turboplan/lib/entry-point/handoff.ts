import { appendLandingUploadParams } from "@/lib/landing-uploads";
import {
  appendAttributionParams,
  type SignupAttribution,
} from "@/lib/signup-attribution";
import type { EntryExample } from "./types";

const PROJECT_TITLE_MAX_LENGTH = 60;
// A shorter leading clause ("I'm a planner,") says too little to name a
// project.
const MIN_CLAUSE_LENGTH = 24;

type SelfServiceHandoff = {
  prompt: string;
  projectTitle: string;
  /** Staging keys of documents attached to the prompt. */
  uploadKeys?: string[];
  attribution?: SignupAttribution;
};

/**
 * The name proposed for the project on the self-service form, where the
 * visitor can still change it: the example's own name when its prompt is sent
 * unchanged, otherwise the prompt's first sentence cut at a word boundary.
 */
export const proposeProjectTitle = (
  prompt: string,
  example?: EntryExample,
): string => {
  const trimmed = prompt.trim();
  if (example && trimmed === example.prompt) {
    return example.projectTitle;
  }

  const firstSentence = trimmed
    .split(/(?<=[.!?])\s|\n/)[0]
    .replace(/\s+/g, " ")
    .replace(/[.!?]+$/, "");
  if (firstSentence.length <= PROJECT_TITLE_MAX_LENGTH) {
    return firstSentence;
  }

  // End at the last clause that fits ("…Ranger District, and we…" keeps
  // "…Ranger District"), else at the last whole word.
  const head = firstSentence.slice(0, PROJECT_TITLE_MAX_LENGTH + 1);
  const clauseEnd = Math.max(
    ...[", ", "; ", ": ", " - "].map((separator) =>
      head.lastIndexOf(separator),
    ),
  );
  const wordEnd = head.lastIndexOf(" ");
  const end =
    clauseEnd >= MIN_CLAUSE_LENGTH
      ? clauseEnd
      : wordEnd > 0
        ? wordEnd
        : PROJECT_TITLE_MAX_LENGTH;
  return head.slice(0, end).replace(/[\s,;:-]+$/, "");
};

/**
 * Where the entry page sends a prompt: the `/self-service` URL the landing
 * page builds (apps/landing-page signup-modal.tsx), without the email. The
 * self-service form asks for it, emails the sign-in link and creates the
 * project from `projectDescription`, claiming any `landingUploads` documents.
 */
export const buildSelfServiceHandoffUrl = ({
  prompt,
  projectTitle,
  uploadKeys,
  attribution,
}: SelfServiceHandoff): string => {
  const params = new URLSearchParams({
    projectTitle,
    projectDescription: prompt.trim(),
  });
  appendLandingUploadParams(params, uploadKeys);
  appendAttributionParams(params, attribution);
  return `/self-service?${params.toString()}`;
};
