/**
 * Pure input assembly for project next-step suggestions, built from the
 * project's saved data only. Kept free of DB and AI imports so it can be
 * unit-tested in isolation.
 */

export type SuggestionFieldInput = {
  label: string;
  value: string;
};

export type SuggestionContextInput = {
  label: string;
  content: string;
};

export type SuggestionTaskInput = {
  title: string;
  status: string;
};

export type SuggestionMilestoneInput = {
  title: string;
  status: string;
  tasks: SuggestionTaskInput[];
};

export type ProjectSuggestionInputs = {
  projectName: string;
  projectDescription: string | null;
  /** The prompt the project was created from, when it differs from the description. */
  projectPrompt: string | null;
  fields: SuggestionFieldInput[];
  context: SuggestionContextInput[];
  documentTitles: string[];
  milestones: SuggestionMilestoneInput[];
  draftedDocumentTitles: string[];
  recentUserRequests: string[];
};

export type ProjectSuggestionPromptVariables = {
  projectName: string;
  projectDescription: string;
  projectFields: string;
  projectContext: string;
  projectDocuments: string;
  projectMilestones: string;
  projectActivity: string;
};

const NONE = "None";

// Per-section budgets keep the whole prompt small enough for the lite model.
export const SUGGESTION_INPUT_LIMITS = {
  name: 200,
  description: 800,
  prompt: 600,
  fieldValue: 150,
  fields: 1200,
  contextEntry: 250,
  context: 1500,
  documentTitle: 120,
  documents: 1200,
  milestoneTitle: 120,
  tasksPerMilestone: 6,
  milestones: 2200,
  activityEntry: 150,
  activity: 1200,
} as const;

// Fields that identify the review framework go first so truncation never drops them.
const PRIORITY_FIELD_PATTERN =
  /framework|agency|review|program|peir|tier|pathway|ceqa|nepa|exemption|exclusion/i;

export const truncateText = (value: string, maxChars: number): string => {
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (trimmed.length <= maxChars) {
    return trimmed;
  }
  return `${trimmed.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
};

/**
 * Join lines until the budget is reached; the dropped remainder is summarized
 * as "(+N more)" so the model knows the list is partial.
 */
export const joinLinesWithinBudget = (
  lines: string[],
  maxChars: number,
): string => {
  if (lines.length === 0) {
    return NONE;
  }
  const kept: string[] = [];
  let total = 0;
  for (const line of lines) {
    if (total + line.length + 1 > maxChars) {
      break;
    }
    kept.push(line);
    total += line.length + 1;
  }
  const dropped = lines.length - kept.length;
  if (dropped > 0) {
    kept.push(`(+${dropped} more)`);
  }
  return kept.join("\n");
};

// Neutralize closing tags (so data cannot break out of <project-data>) and
// template braces (so data cannot inject later {{variable}} substitutions).
export const sanitizeSuggestionPromptValue = (value: string): string =>
  value.replace(/<\//g, "&lt;/").replace(/\{\{|\}\}/g, "");

export const extractMessageText = (parts: unknown): string => {
  if (!Array.isArray(parts)) {
    return "";
  }
  return parts
    .filter(
      (part): part is { type: "text"; text: string } =>
        typeof part === "object" &&
        part !== null &&
        (part as { type?: unknown }).type === "text" &&
        typeof (part as { text?: unknown }).text === "string",
    )
    .map((part) => part.text)
    .join("\n")
    .trim();
};

const formatFields = (fields: SuggestionFieldInput[]): string => {
  const seen = new Set<string>();
  const unique = fields.filter((field) => {
    const value = field.value.trim();
    const key = `${field.label.trim().toLowerCase()}::${value.toLowerCase()}`;
    if (!value || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
  const ordered = [
    ...unique.filter((field) => PRIORITY_FIELD_PATTERN.test(field.label)),
    ...unique.filter((field) => !PRIORITY_FIELD_PATTERN.test(field.label)),
  ];
  return joinLinesWithinBudget(
    ordered.map(
      (field) =>
        `- ${truncateText(field.label, 60)}: ${truncateText(field.value, SUGGESTION_INPUT_LIMITS.fieldValue)}`,
    ),
    SUGGESTION_INPUT_LIMITS.fields,
  );
};

const formatContext = (context: SuggestionContextInput[]): string =>
  joinLinesWithinBudget(
    context
      .filter((item) => item.content.trim())
      .map(
        (item) =>
          `- ${truncateText(item.label, 80)}: ${truncateText(item.content, SUGGESTION_INPUT_LIMITS.contextEntry)}`,
      ),
    SUGGESTION_INPUT_LIMITS.context,
  );

const formatMilestones = (milestones: SuggestionMilestoneInput[]): string => {
  const blocks = milestones.map((milestone) => {
    const header = `- ${truncateText(milestone.title, SUGGESTION_INPUT_LIMITS.milestoneTitle)} [${milestone.status}]`;
    const shownTasks = milestone.tasks.slice(
      0,
      SUGGESTION_INPUT_LIMITS.tasksPerMilestone,
    );
    const taskLines = shownTasks.map(
      (task) =>
        `  - ${truncateText(task.title, SUGGESTION_INPUT_LIMITS.milestoneTitle)} [${task.status}]`,
    );
    const hiddenTasks = milestone.tasks.length - shownTasks.length;
    if (hiddenTasks > 0) {
      taskLines.push(`  - (+${hiddenTasks} more tasks)`);
    }
    return [header, ...taskLines].join("\n");
  });
  return joinLinesWithinBudget(blocks, SUGGESTION_INPUT_LIMITS.milestones);
};

const formatActivity = (
  draftedDocumentTitles: string[],
  recentUserRequests: string[],
): string =>
  joinLinesWithinBudget(
    [
      ...draftedDocumentTitles.map(
        (title) =>
          `- Drafted: ${truncateText(title, SUGGESTION_INPUT_LIMITS.activityEntry)}`,
      ),
      ...recentUserRequests
        .filter((request) => request.trim())
        .map(
          (request) =>
            `- Requested: ${truncateText(request, SUGGESTION_INPUT_LIMITS.activityEntry)}`,
        ),
    ],
    SUGGESTION_INPUT_LIMITS.activity,
  );

const formatDescription = (
  description: string | null,
  prompt: string | null,
): string => {
  const cleanDescription = description?.trim() ?? "";
  const cleanPrompt = prompt?.trim() ?? "";
  const parts: string[] = [];
  if (cleanDescription) {
    parts.push(
      truncateText(cleanDescription, SUGGESTION_INPUT_LIMITS.description),
    );
  }
  if (cleanPrompt && cleanPrompt !== cleanDescription) {
    parts.push(
      `Original request: ${truncateText(cleanPrompt, SUGGESTION_INPUT_LIMITS.prompt)}`,
    );
  }
  return parts.length > 0 ? parts.join("\n") : NONE;
};

/**
 * Turn the gathered project data into the (sanitized, size-capped) template
 * variables of the `project-next-step-suggestions` prompt.
 */
export const buildProjectSuggestionPromptVariables = (
  inputs: ProjectSuggestionInputs,
): ProjectSuggestionPromptVariables => {
  const variables: ProjectSuggestionPromptVariables = {
    projectName: truncateText(inputs.projectName, SUGGESTION_INPUT_LIMITS.name),
    projectDescription: formatDescription(
      inputs.projectDescription,
      inputs.projectPrompt,
    ),
    projectFields: formatFields(inputs.fields),
    projectContext: formatContext(inputs.context),
    projectDocuments: joinLinesWithinBudget(
      [...new Set(inputs.documentTitles.map((title) => title.trim()))]
        .filter(Boolean)
        .map(
          (title) =>
            `- ${truncateText(title, SUGGESTION_INPUT_LIMITS.documentTitle)}`,
        ),
      SUGGESTION_INPUT_LIMITS.documents,
    ),
    projectMilestones: formatMilestones(inputs.milestones),
    projectActivity: formatActivity(
      inputs.draftedDocumentTitles,
      inputs.recentUserRequests,
    ),
  };

  return Object.fromEntries(
    Object.entries(variables).map(([key, value]) => [
      key,
      sanitizeSuggestionPromptValue(value),
    ]),
  ) as ProjectSuggestionPromptVariables;
};
