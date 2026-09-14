/**
 * Tasks-specific prompt additions.
 *
 * Only included when the tasks feature is enabled.
 * Extracted from the former core/index.ts.
 */

/**
 * Tasks-specific additions to the regular prompt
 * Only included when tasks feature is enabled
 */
export const tasksPromptAdditions = `

# TASK-SPECIFIC RULES:
1. **Queries vs Creation**: "What tasks exist?" = answer in chat. "Create tasks" = gather context first, then create.
2. **Context Before Tasks**: Before creating task documents, ask about: project description, location, timeline, conditions.

# ADDITIONAL DOCUMENT TYPES:
- Task management documents`;
