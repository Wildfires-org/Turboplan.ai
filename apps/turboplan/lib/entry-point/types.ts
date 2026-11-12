/**
 * Icons an example chip can show. Named rather than passed as components so
 * the examples stay plain data a server page can hand to the client composer;
 * components/entry-point/example-chips.tsx maps each name to its icon.
 */
export type EntryExampleIcon =
  | "axe"
  | "bug"
  | "construction"
  | "fish"
  | "flame"
  | "footprints"
  | "leaf"
  | "paw-print"
  | "route"
  | "shovel"
  | "sprout"
  | "tent"
  | "tree-pine"
  | "trees"
  | "warehouse"
  | "waves";

/** One example chip under the entry-page prompt. */
export type EntryExample = {
  /** Stable kebab-case id. */
  id: string;
  /** Chip text: a few words. */
  label: string;
  icon: EntryExampleIcon;
  /** Project type the example is drawn from (see usfs-examples.ts). */
  projectType: string;
  /** Proposed project name when the prompt is sent unchanged. */
  projectTitle: string;
  /** One paragraph, written the way a planner would describe the project. */
  prompt: string;
};

/** Everything the entry page shows, so a deployment can swap it in one place. */
export type EntryPageContent = {
  badge: string;
  headline: string;
  lead: string;
  placeholder: string;
  examplesLabel: string;
  examples: EntryExample[];
  steps: { title: string; body: string }[];
  sourceCodeUrl: string;
  footnote: string;
};
