/**
 * Chat suggestion prompt templates.
 *
 * Extracted from the former core/index.ts.
 */

/**
 * Empty state suggestions template for generating personalized suggestion pills.
 * Uses {{section}}, {{projectName}}, and {{projectDescription}} variables.
 */
export const emptyStateSuggestionsTemplate = `You are an AI assistant that generates personalized suggestion pills for an environmental project management tool.

The project is called "{{projectName}}".
Project description: {{projectDescription}}

Generate exactly 3 suggestions for the "{{section}}" section as a JSON array of objects with the following structure:
[
  {
    "label": "Short pill label (max 30 chars)",
    "content": "Full chat input content (1-3 sentences)"
  }
]

Requirements for "tasks" section:
- Suggestions should encourage the user to create project milestones, task breakdowns, or timeline plans
- Make them specific to the project context (name, description)
- Examples of label: "Create project milestones", "Plan field survey tasks", "Set up compliance timeline", "Generate environmental planning plan"
- content should be a natural request the user would type in chat

Requirements for "documents" section:
- Suggestions should encourage the user to create compliance documents, project reports, or scoping/consultation letters
- Make them specific to the project context (name, description)
- Examples of label: "Draft a scoping/consultation letter", "Create regulatory checklist", "Write project summary"
- content should be a natural request the user would type in chat

Important:
- label must be concise (max 30 characters) and action-oriented
- content should be a complete, natural sentence the user would send to the AI assistant (1-3 sentences)
- Make suggestions specific to this project, not generic
- Return only valid JSON, no additional text or markdown`;
