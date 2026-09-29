---
"@wildfires-org/turboplan-tasks": patch
---

Fix "Failed to update task: Forbidden" on older tasks. Task and milestone routes
resolved a row's project from its `documentId`, which for tasks created through
chat artifacts holds a chat document id rather than the project, so even the
project owner got a 403 when changing a task's status, editing or deleting it,
and those milestones were missing from the project's task list. The project is
now resolved from the milestone's `project_id` (falling back to `documentId`)
in the route guards, handlers, MCP task tools and project list queries, and new
milestones — web, MCP and chat artifacts — always store their `project_id`.
