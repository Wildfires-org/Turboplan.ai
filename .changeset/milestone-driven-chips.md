---
"@wildfires-org/turboplan-research-agent-integration": patch
"@wildfires-org/turboplan-ai": patch
"turboplan": patch
---

Project chat next-step chips now lead with documents that move the project's
saved milestones forward. The first chips (up to four, earliest due first) turn
the open tasks into something the assistant can draft right away, such as an
email to the agency a task names, an interview presentation outline or a
contract checklist. Framework deliverables fill the remaining chips. Before
this, saved milestones had no effect and the chips were the generic framework
list. The `project-next-step-suggestions` prompt now gets due dates for open
milestones and tasks, plus the descriptions of open tasks. Deployments with
`USE_EXTERNAL_PROMPTS` on need the prompt reseeded (`seed:prompts`) to pick up
the new wording.

Saving more items from the research panel after the research phase is
completed now rebuilds the chips. Before, they were built only once, at
completion, so milestones added afterwards never showed up.
