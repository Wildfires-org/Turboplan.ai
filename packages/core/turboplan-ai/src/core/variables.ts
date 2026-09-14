/**
 * Prompt variable definitions for TurboPlan
 *
 * Variables use {{variableName}} syntax and are replaced at runtime.
 * Protected variables are read-only in the admin UI.
 */

/**
 * Represents a variable that can be used in prompts.
 */
export interface PromptVariable {
  /** Variable name (without braces) */
  name: string;
  /** Human-readable description */
  description: string;
  /** If true, this variable's section is read-only in the admin UI */
  isProtected: boolean;
  /** List of prompt names this variable applies to. Empty array = all prompts. */
  applicablePrompts: string[];
}

/**
 * List of available template variables for prompts.
 * These are {{variableName}} placeholders that get replaced at runtime.
 * Only shown in the variable picker for prompts that use them.
 *
 * Note: This does NOT include runtime composition parameters like
 * projectTasksContext - those are
 * used by the systemPrompt() function for conditional logic, not template substitution.
 */
export const PROMPT_VARIABLES: PromptVariable[] = [
  {
    name: "currentContent",
    description: "Current document content for update operations",
    isProtected: true,
    applicablePrompts: [
      "update-document-text",
      "update-document-code",
      "update-document-sheet",
    ],
  },
  {
    name: "description",
    description: "Project description for title generation",
    isProtected: false,
    applicablePrompts: ["generate-titles-user"],
  },
  {
    name: "organizations",
    description: "List of available organizations for title generation",
    isProtected: true,
    applicablePrompts: ["generate-titles-user"],
  },
  {
    name: "offices",
    description: "List of available offices for title generation",
    isProtected: true,
    applicablePrompts: ["generate-titles-user"],
  },
  {
    name: "section",
    description: "Module section (tasks or documents)",
    isProtected: true,
    applicablePrompts: ["empty-state-suggestions"],
  },
  {
    name: "projectName",
    description: "Name of the project",
    isProtected: true,
    applicablePrompts: [
      "base-identity",
      "empty-state-suggestions",
      "research-agent-start-prompt",
    ],
  },
  {
    name: "projectDescription",
    description: "Description of the project",
    isProtected: true,
    applicablePrompts: [
      "empty-state-suggestions",
      "research-agent-start-prompt",
    ],
  },
  {
    name: "projectFields",
    description:
      "Custom project fields (name/value pairs) for research agent start prompt",
    isProtected: true,
    applicablePrompts: ["research-agent-start-prompt"],
  },
  {
    name: "projectContext",
    description:
      "Saved project context entries for research agent start prompt",
    isProtected: true,
    applicablePrompts: ["research-agent-start-prompt"],
  },
  {
    name: "projectDocuments",
    description:
      "Extracted text of uploaded project documents for research agent start prompt",
    isProtected: true,
    applicablePrompts: ["research-agent-start-prompt"],
  },
  {
    name: "recentConversation",
    description:
      "Recent chat conversation context for research agent start prompt",
    isProtected: true,
    applicablePrompts: ["research-agent-start-prompt"],
  },
  {
    name: "sections",
    description:
      "Formatted markdown sections (fields, milestones, documents) from research agent analysis",
    isProtected: true,
    applicablePrompts: [
      "research-agent-saved-context",
      "research-agent-unsaved-context",
    ],
  },
  {
    name: "messages",
    description:
      "Formatted chat messages forwarded to the running research agent",
    isProtected: true,
    applicablePrompts: ["research-agent-forward-messages"],
  },
];

/**
 * Context object for template variable replacement.
 * Only includes actual {{variableName}} placeholders.
 */
export interface VariableContext {
  count?: number;
  currentContent?: string | null;
  description?: string;
  organizations?: string;
  offices?: string;
  section?: string;
  projectName?: string;
  projectDescription?: string;
  projectFields?: string;
  projectContext?: string;
  projectDocuments?: string;
  recentConversation?: string;
  sections?: string;
  messages?: string;
}

/**
 * Replace {{variableName}} placeholders in content with actual values.
 */
export function parsePromptVariables(
  content: string,
  context: VariableContext,
): string {
  let result = content;

  if (context.count !== undefined) {
    const count = String(context.count);
    result = result.replace(/\{\{count\}\}/g, () => count);
  }

  if (context.currentContent !== undefined && context.currentContent !== null) {
    const currentContent = context.currentContent;
    result = result.replace(/\{\{currentContent\}\}/g, () => currentContent);
  }

  if (context.description !== undefined) {
    const description = context.description;
    result = result.replace(/\{\{description\}\}/g, () => description);
  }

  if (context.organizations !== undefined) {
    const organizations = context.organizations;
    result = result.replace(/\{\{organizations\}\}/g, () => organizations);
  }

  if (context.offices !== undefined) {
    const offices = context.offices;
    result = result.replace(/\{\{offices\}\}/g, () => offices);
  }

  if (context.section !== undefined) {
    const section = context.section;
    result = result.replace(/\{\{section\}\}/g, () => section);
  }

  if (context.projectName !== undefined) {
    const projectName = context.projectName;
    result = result.replace(/\{\{projectName\}\}/g, () => projectName);
  }

  if (context.projectDescription !== undefined) {
    const projectDescription = context.projectDescription;
    result = result.replace(
      /\{\{projectDescription\}\}/g,
      () => projectDescription,
    );
  }

  if (context.projectFields !== undefined) {
    const projectFields = context.projectFields;
    result = result.replace(/\{\{projectFields\}\}/g, () => projectFields);
  }

  if (context.projectContext !== undefined) {
    const projectContext = context.projectContext;
    result = result.replace(/\{\{projectContext\}\}/g, () => projectContext);
  }

  if (context.projectDocuments !== undefined) {
    const projectDocuments = context.projectDocuments;
    result = result.replace(
      /\{\{projectDocuments\}\}/g,
      () => projectDocuments,
    );
  }

  if (context.recentConversation !== undefined) {
    const recentConversation = context.recentConversation;
    result = result.replace(
      /\{\{recentConversation\}\}/g,
      () => recentConversation,
    );
  }

  if (context.sections !== undefined) {
    const sections = context.sections;
    result = result.replace(/\{\{sections\}\}/g, () => sections);
  }

  if (context.messages !== undefined) {
    const messages = context.messages;
    result = result.replace(/\{\{messages\}\}/g, () => messages);
  }

  return result;
}

/**
 * Extract variable names from prompt content.
 * Returns array of variable names found (without braces).
 */
export function extractVariables(content: string): string[] {
  const regex = /\{\{(\w+)\}\}/g;
  const variables: string[] = [];
  let match;

  while ((match = regex.exec(content)) !== null) {
    if (!variables.includes(match[1])) {
      variables.push(match[1]);
    }
  }

  return variables;
}

/**
 * Check if a variable name is valid (exists in PROMPT_VARIABLES).
 */
export function isValidVariable(name: string): boolean {
  return PROMPT_VARIABLES.some((v) => v.name === name);
}

/**
 * Get variables applicable to a specific prompt.
 * Returns only variables that have the prompt name in their applicablePrompts array.
 */
export function getVariablesForPrompt(promptName: string): PromptVariable[] {
  return PROMPT_VARIABLES.filter((v) =>
    v.applicablePrompts.includes(promptName),
  );
}

/**
 * Check if a variable is applicable to a specific prompt.
 */
export function isVariableApplicable(
  variableName: string,
  promptName: string,
): boolean {
  const variable = PROMPT_VARIABLES.find((v) => v.name === variableName);
  if (!variable) return false;
  return variable.applicablePrompts.includes(promptName);
}
