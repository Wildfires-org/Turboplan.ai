---
"@wildfires-org/turboplan-workspace": patch
---

Validate that task and milestone references belong to the project. Adding a
project member with a `taskAssignment` accepted any task or milestone id, so a
project owner could add assignees to another project's tasks and have that
project's task titles emailed to an address of their choice; the ids are now
checked against the project (400 otherwise) and assignment and invitation
e-mails are scoped to it. MCP `create_task`, `update_task`, `create_milestone`
and `update_milestone` now run the same assignee, dependency and document
reference checks as the web routes. Project membership of a task or milestone
is resolved from either its `documentId` or its milestone's `projectId`, so
older tasks created before the `documentId = projectId` convention are no
longer rejected as dependencies.
