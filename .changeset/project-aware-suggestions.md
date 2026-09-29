---
"@wildfires-org/turboplan-research-agent-integration": minor
"@wildfires-org/turboplan-ai": minor
"@wildfires-org/research-agent": patch
"turboplan": patch
---

Project chat quick-action chips now suggest the next steps for the project's
own review framework and stage instead of a fixed NEPA set (scoping letter,
purpose and need, decision memo). The chips are generated when the user
completes the research phase, from what was saved to the project: description
and original request, fields (framework, lead agency, review type, program
EIR), context, documents, milestones and tasks, and what has already been
drafted or requested in chat. The chat shows a loading row until they arrive.
Generation runs through the new
`POST /api/ai/research-agent/bootstrapper/project/:projectId/suggestions/regenerate`
endpoint (project editors, credit-gated). The prompt lives in the prompt admin
as `project-next-step-suggestions` and covers NEPA, CEQA and CalVTP tiering,
with neutral planning chips when the framework is unknown. The fallback chips,
shown when generation fails or never ran, are framework-neutral.

The full-mode chat prompt and the quick-response bubbles no longer steer toward
NEPA documents, and the research agent recognises CalVTP as a framework with
its typical milestones.
