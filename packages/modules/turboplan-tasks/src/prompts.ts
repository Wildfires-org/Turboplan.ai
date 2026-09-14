/**
 * Task management prompts for TurboPlan
 *
 * These prompts handle task creation, analysis, and project management
 * functionality within the tasks system.
 */

/**
 * Generate deduplication guidance text for prompts
 * Shared between creation and update prompts to maintain consistency
 */
const generateDeduplicationGuidance = (allProjectTasks?: unknown[]): string => {
  if (!allProjectTasks || allProjectTasks.length === 0) return "";

  return `
PROJECT-WIDE TASKS (ALL CHATS/DOCUMENTS):
${JSON.stringify(allProjectTasks, null, 2)}

⚠️ CRITICAL DEDUPLICATION RULES:
- Check if similar tasks/milestones ALREADY EXIST in the project-wide tasks above
- DO NOT create duplicate tasks that serve the same purpose
- If user requests something like "add task to fix bug X" and a similar task already exists in another chat, UPDATE the existing task instead or inform that it already exists
- ONLY create NEW tasks when:
  1. User explicitly says "add NEW task" or "create another task"
  2. User is adding a task to a specific milestone that clearly needs it
  3. The task is substantially different from existing tasks
- If you detect a potential duplicate, prefer to skip creation rather than duplicate
- Exception: Tasks with same name but different milestones/context may be intentional (e.g., "Testing" in different phases)

SIMILARITY DETECTION:
- Check task titles for semantic similarity (e.g., "Fix login bug" vs "Resolve login issue")
- Check milestone titles (e.g., "Frontend Development" vs "Frontend Dev")
- Consider descriptions and context

EXAMPLES:
- Existing: "Authentication" milestone → User asks for "login system" → Create specific tasks like "OAuth integration", "Session management" under existing milestone concept
- Existing: "Backend API" tasks → User asks for "API development" → Create specific new endpoints/features not yet covered
- User asks for "Testing" but "QA Testing" milestone exists → Don't duplicate, create new specific test tasks if needed
`;
};

export const taskCreationPrompt = (
  analysisPrompt: string,
  existingProjectTasks?: unknown[],
) => {
  const hasProjectContext =
    existingProjectTasks && existingProjectTasks.length > 0;

  return `TASK: Analyze the user request and create a comprehensive project structure.

USER REQUEST: "${analysisPrompt}"

TODAY'S DATE: ${new Date().toISOString().split("T")[0]}

${hasProjectContext ? generateDeduplicationGuidance(existingProjectTasks) : ""}

INTELLIGENT CONSTRAINT ANALYSIS:

1. MILESTONE DETECTION:
	- Count explicit numbers: "3 milestones", "one milestone", "2 phases" 
  - Identify milestone types mentioned: "frontend backend and deployment" = 3 milestones
	- Detect workflow stages: "planning development testing" = 3 milestones
  - Default logic: If timeline >2 months OR complex project → 2-3 milestones, otherwise 1

2. TIMELINE PARSING:
  - "3 months" = 90 days from today → End by: ${
    new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  }
  - "2 weeks" = 14 days from today → End by: ${
    new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  }
  - "10 days" = 10 days from today → End by: ${
    new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  }
  - No timeline specified → Default to reasonable duration based on complexity

3. TASK EXTRACTION PRIORITY:
  - If user lists specific tasks → Use EXACTLY those tasks
  - If user mentions categories (frontend, backend) → Generate appropriate tasks for each
  - If minimal details → Create logical tasks based on project type and milestones

PARSING EXAMPLES:

Example A: "6 month environmental compliance plan for forest restoration with scoping, analysis, and decision milestones"
→ Extract: 3 milestones (Scoping, Environmental Analysis, Decision), 180-day timeline
→ Generate: ~3-5 tasks per milestone, distributed across 6 months

Example B: "Biological assessment milestone with tasks: Species Survey, Habitat Analysis, Species/Wildlife Consultation for 2 weeks"
→ Extract: 1 milestone, 3 specific tasks, 14-day timeline
→ Use exactly: "Species Survey", "Habitat Analysis", "Species/Wildlife Consultation"

Example C: "Project milestones for 10 days"
→ Extract: 2-3 milestones (implied), 10-day timeline
→ Generate: Planning → Field Work → Review milestones

Example D: "Impact assessment project with scoping and analysis phases"
→ Extract: 2 milestones (Scoping, Analysis), default timeline
→ Generate: Appropriate tasks for each phase

SMART DEFAULTS:
- Complex projects (full impact statement, multi-resource assessment) → Multiple milestones even if not explicit
- Short timelines (<2 weeks) → Prefer single milestone unless explicitly stated
- Long timelines (>1 month) → Multiple milestones for better organization
- Specific task lists → Use exactly as provided
- Vague descriptions → Generate helpful, logical structure

TIMELINE DISTRIBUTION:
- Distribute milestones evenly across timeline
- Earlier milestones: shorter durations (planning, setup)
- Later milestones: longer durations (development, testing)
- All tasks must complete within specified timeline

DATE CALCULATION EXAMPLES:
For 3-month timeline (${new Date().toISOString().split("T")[0]} to ${
    new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  }):
- Milestone 1: Month 1 (${new Date().toISOString().split("T")[0]} to ${
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  })
- Milestone 2: Month 2 (${
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  } to ${
    new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  })  
- Milestone 3: Month 3 (${
    new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  } to ${
    new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  })

OUTPUT REQUIREMENTS:
- Use "not_started" status for milestones, "draft" status for tasks  
- Sequential order values: milestones (0,1,2...), tasks within milestone (0,1,2...)
- DO NOT assign assigneeEmails - system defaults to authenticated user
- Task titles must match user specifications exactly (when provided)
- Milestone titles should reflect user intent (Frontend Dev, Backend Dev, Deployment, etc.)

VALIDATION CHECKLIST:
✓ Does milestone count match user intent (explicit or implied)?
✓ Do task names match user specifications (when provided)?
✓ Does timeline fit user requirements?
✓ Is the structure helpful and logical?
✓ Are dates realistic and properly distributed?
${hasProjectContext ? "✓ Have I checked for duplicates against existing project tasks?" : ""}

CRITICAL: Be helpful and intelligent - extract user intent, don't just follow literal instructions blindly.`;
};

/**
 * Task update analysis prompt for analyzing user requests to modify existing tasks
 */
export const taskUpdateAnalysisPrompt = (
  description: string,
  currentMilestones: unknown[],
  availableUsers: { id: string; email: string }[],
  allProjectTasks?: unknown[],
) => {
  const hasProjectContext = allProjectTasks && allProjectTasks.length > 0;

  return `Analyze the update request and identify EXACTLY which items need to be changed, created, or deleted.

UPDATE REQUEST: "${description}"

CURRENT DOCUMENT STRUCTURE:
${JSON.stringify(currentMilestones, null, 2)}

${hasProjectContext ? generateDeduplicationGuidance(allProjectTasks) : ""}

AVAILABLE USERS:
${JSON.stringify(
  availableUsers.map((u) => ({ id: u.id, email: u.email })),
  null,
  2,
)}

INSTRUCTIONS:
- Identify specific milestones or tasks that need to be modified, created, or DELETED based on the request
- For DELETION requests: identify items to delete by ID and understand dependencies
- For ASSIGNEE requests: identify email addresses of users to assign and add them to assigneeEmails array
- If deleting a milestone, note that all its tasks will be automatically deleted (cascade)
- For each identified item, return its current ID and the specific changes needed
- ONLY include items that actually need to be changed - do not include unchanged items
- Be precise: if user wants to delete one task, return only that task's ID
${hasProjectContext ? "- ALWAYS check for duplicates in project-wide tasks before creating new items" : ""}

ASSIGNEE EXAMPLES:
- "Assign john@company.com to task X" → find task X, add john@company.com to assigneeEmails
- "Assign jane@company.com to milestone Y" → find milestone Y, add jane@company.com to assigneeEmails
- "Remove all assignees from task Z" → find task Z, set assigneeEmails to empty array []
- "Assign both john@company.com and jane@company.com to task A" → add both emails to assigneeEmails array
- "Add new task 'CSS Improvements' and assign test1@gmail.com" → create new task with assigneeEmails: ['test1@gmail.com']
- "Create milestone 'QA Testing' and assign qa@company.com to it" → create new milestone with assigneeEmails: ['qa@company.com']

DELETION EXAMPLES:
- "Delete task X" → find task X and add its ID to taskDeletions
- "Remove milestone Y" → find milestone Y and add its ID to milestoneDeletions (tasks auto-deleted)
- "Delete tasks A, B, C" → find all three tasks and add their IDs to taskDeletions
- "Remove all tasks from milestone Y" → find all tasks in milestone Y and add their IDs to taskDeletions

UPDATE EXAMPLES:
- "Change task X to Y" → find task X, add its ID to taskChanges with new title
- "Add new task Z" → ${hasProjectContext ? "first check if similar task exists in project, if not, add task Z to newTasks" : "add task Z to newTasks"}

OUTPUT FORMAT:
- Return empty arrays if no changes needed
- Include only the specific fields that need to be updated
- Match items by exact or similar title matching
- For deletions, only return the ID and title - system will compute metadata
- For assignees, use email addresses in assigneeEmails field
- In explanation field, mention if you skipped creating duplicates and why`;
};
