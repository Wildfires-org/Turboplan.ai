import type { EntryPageContent } from "./types";
import { USFS_EXAMPLES } from "./usfs-examples";

/**
 * Copy and example chips for the prompt entry page (see config.ts). A
 * deployment that serves another audience swaps the examples here.
 */
export const ENTRY_PAGE_CONTENT: EntryPageContent = {
  badge: "US Forest Service demo",
  headline: "Accelerate NEPA.",
  lead: "Describe a project and get a planning workspace with draft NEPA documents in minutes, not weeks.",
  placeholder:
    "Describe your project: what you plan to do, where, how many acres, and why.",
  examplesLabel: "Start from a Forest Service example",
  examples: USFS_EXAMPLES,
  steps: [
    {
      title: "Describe the project",
      body: "A few sentences is enough. Attach a scoping document or proposed action if you have one.",
    },
    {
      title: "Confirm your email",
      body: "We email you a sign-in link. There is no password to set.",
    },
    {
      title: "Start planning",
      body: "Your project opens with the AI ready to draft its NEPA documents from your description.",
    },
  ],
  sourceCodeUrl: "https://github.com/Wildfires-org/Turboplan.ai",
  footnote:
    "Open source under the Apache 2.0 license. Example projects and places are fictional.",
};
