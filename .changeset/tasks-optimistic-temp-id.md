---
"@wildfires-org/turboplan-tasks": patch
"@wildfires-org/turboplan-gantt-task": patch
---

Tasks: deleting, renaming or changing the status of a task or milestone right
after creating it now works without a reload. The page kept the optimistic
`temp-<uuid>` id, so the request failed with a 500 and a deleted task came back
on reload. Failed task-page actions no longer surface as unhandled promise
rejections, and a malformed task or milestone id in the API now gets the same
403 as an unknown one instead of a 500.

Gantt: the package always builds in production mode. Under `NODE_ENV=test`
(the E2E build) it emitted `jsxDEV` calls against the production React
runtime, so the tasks page crashed for any project with a milestone.
