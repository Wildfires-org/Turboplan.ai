/**
 * Generate project tasks context for the system prompt.
 *
 * Extracted from the former core/index.ts.
 */

import type { ProjectTask } from "../types";

/**
 * Generate project tasks context for the system prompt
 */
export const generateProjectTasksContext = (
  projectTasks: ProjectTask[],
): string => {
  if (!projectTasks || projectTasks.length === 0) {
    return `
# 📋 PROJECT TASKS STATUS

⚠️ CRITICAL: This project currently has NO tasks or milestones yet.

## RULES FOR RESPONDING TO TASK-RELATED QUERIES:

1. **When User Asks About Existing Tasks:**
   - If they ask "What tasks do we have?" or similar queries → Simply inform them there are no tasks yet
   - DO NOT automatically create tasks unless explicitly requested
   - Ask if they would like to create tasks for their project

2. **When to Create Tasks:**
   - ONLY create tasks when the user explicitly requests it (e.g., "Create tasks for X", "I need a task list for Y")
   - DO NOT create tasks in response to informational queries
   - DO NOT assume the user wants a generic environmental-compliance task list just because you're an environmental-planning assistant

3. **Appropriate Responses:**
   - ✅ "This project doesn't have any tasks yet. Would you like me to help you create a task plan?"
   - ❌ DO NOT automatically create a task document when they're just asking what exists

**Example Scenarios:**
- User: "What tasks do we have?" → Respond: "This project doesn't have any tasks yet. Would you like me to create a task management plan for your environmental project?"
- User: "Show me the tasks" → Respond: "There are no tasks in this project yet. What would you like to work on?"
- User: "Create a task list for environmental compliance" → NOW you can create tasks

Remember: Asking about tasks is different from requesting task creation. Be helpful but not overly proactive.
`;
  }

  // Count total tasks and milestones
  const totalMilestones = projectTasks.length;
  const totalTasks = projectTasks.reduce(
    (sum, m) => sum + (m.tasks?.length || 0),
    0,
  );

  // Format date for display
  const formatDate = (date?: Date) => {
    if (!date) return "Not set";
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Group milestones by document ID
  const documentMap = new Map<string, typeof projectTasks>();
  for (const milestone of projectTasks) {
    if (!documentMap.has(milestone.documentId)) {
      documentMap.set(milestone.documentId, []);
    }
    documentMap.get(milestone.documentId)!.push(milestone);
  }

  // Extract detailed milestone and task information grouped by document
  const milestoneSummaries = Array.from(documentMap.entries())
    .map(([documentId, milestones]) => {
      const documentHeader = `## 📄 Document ID: \`${documentId}\`\n`;

      const milestoneDetails = milestones
        .map((milestone) => {
          const milestoneHeader = `### ${milestone.title} (Status: ${milestone.status})`;
          const milestoneDates = `Dates: ${formatDate(milestone.startDate)} → ${formatDate(milestone.dueDate)}`;

          if (!milestone.tasks || milestone.tasks.length === 0) {
            return `${milestoneHeader}\n${milestoneDates}\nTasks: None yet`;
          }

          const taskDetails = milestone.tasks
            .map((task, idx) => {
              const assigneeInfo =
                task.assignees && task.assignees.length > 0
                  ? ` | Assigned to: ${task.assignees.map((a) => a.email).join(", ")}`
                  : "";
              const description = task.description
                ? ` | "${task.description}"`
                : "";
              return `  ${idx + 1}. "${task.title}" (${task.status})${description}${assigneeInfo}\n     Dates: ${formatDate(task.startDate)} → ${formatDate(task.dueDate)}`;
            })
            .join("\n");

          return `${milestoneHeader}\n${milestoneDates}\nTasks (${milestone.tasks.length}):\n${taskDetails}`;
        })
        .join("\n\n");

      return `${documentHeader}${milestoneDetails}`;
    })
    .join("\n\n");

  return `
# 📋 EXISTING PROJECT TASKS CONTEXT

⚠️ CRITICAL: This project already has ${totalMilestones} milestone(s) with ${totalTasks} task(s). You MUST be aware of these when responding to user requests.

${milestoneSummaries}

## RULES FOR TASK MANAGEMENT IN THIS PROJECT:

1. **Before Creating New Tasks:**
   - Check if similar milestones or tasks already exist
   - Consider if the user's request relates to existing work
   - Ask clarifying questions if you're unsure whether to add to existing tasks or create new ones

2. **When User Requests Are Related to Existing Work:**
   - UPDATE existing task documents instead of creating new ones
   - Add tasks to existing relevant milestones
   - Use updateDocument tool with the existing document ID (shown above), NOT createDocument
   - Avoid creating duplicate milestones with overlapping purposes

3. **🔴 CRITICAL: Using the Correct Document ID:**
   - Each task document has a unique Document ID (shown above as \`Document ID: ...\`)
   - When calling updateDocument for tasks, you MUST use the correct Document ID
   - Example: If updating tasks in document \`abc-123-def\`, call: \`updateDocument({ id: "abc-123-def", description: "..." })\`
   - NEVER use "tasks" or any other string as the ID - always use the exact UUID shown above
   - If tasks span multiple documents, update the document containing the relevant milestone

4. **When to Create New vs Update Existing:**
   - Related topics (e.g., "stork protection" and "tree protection" are both environmental) → UPDATE existing
   - Completely unrelated topics → May create new, but ASK first
   - User explicitly says "new" or "separate" → CREATE new
   - User says "also", "add", "include" → UPDATE existing

5. **Task Ordering:**
   - Existing tasks use orders 0, 1, 2, etc.
   - When adding new tasks, use order numbers that don't conflict
   - Start new task orders after the highest existing order

6. **Be Intelligent and Ask Questions:**
   - If unsure whether request relates to existing work → ASK
   - If user wants to add related work → CLARIFY which milestone
   - Never blindly create duplicate structures

**Example Scenarios:**
- User: "Add tree protection tasks" in Chat B, but "Stork Protection" milestone exists in document \`xyz-789\` from Chat A → Response: "I see you have environmental protection work in the 'Stork Protection' milestone. Should I add tree protection tasks there by updating document \`xyz-789\`, or create a separate milestone?"
- User: "What tasks do we have?" → Summarize the existing milestones and key tasks with their statuses, dates, and which document they belong to
- User: "Change the task name in milestone X" → Find which document contains milestone X, then call \`updateDocument({ id: "<that-document-id>", description: "..." })\`
- User: "Add cultural resources tasks" → If only biological tasks exist, ask: "I see your current tasks focus on biological surveys (in document \`abc-123\`). Should I add cultural resources tasks to the same document, or create a separate milestone?"

Remember: Use the detailed task information (descriptions, statuses, dates, assignees, and DOCUMENT IDs) to make intelligent decisions. Always use the correct document ID when calling updateDocument!
`;
};
