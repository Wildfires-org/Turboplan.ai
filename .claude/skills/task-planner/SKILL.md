---
name: task-planner
description: Plan and execute development tasks for the TurboPlan monorepo. Use when the user wants to (1) plan a new feature, bug fix, or refactor before coding, (2) break a task into implementation phases, (3) execute an existing plan phase-by-phase with review gates. Triggers on requests like "plan this task", "help me plan", "let's plan the implementation", "execute phase 1", "continue with the next phase", or when given a task description that needs structured planning before implementation.
---

# Task Planner

Plan and execute TurboPlan development tasks in structured, reviewable phases.

## Two Modes

1. **Planning mode** - Create a structured implementation plan from a task description
2. **Execution mode** - Execute an existing plan phase-by-phase with review gates

## Planning Mode

When the user provides a task description and wants to plan before coding:

### Before planning

If anything about the task is unclear, ambiguous, or could be interpreted in multiple ways:
- Stop and ask clarifying questions
- Present alternatives if multiple valid approaches exist
- Do not make assumptions about technical choices without confirming

Consult CLAUDE.md (already in system prompt) for TurboPlan architecture, conventions, and key rules.

### Plan output

Save the plan as `docs/plans/<ticket-id>-<short-name>.md` (e.g., `docs/plans/TC-199-search-fix.md`). If no ticket ID exists, use a descriptive name.

Use this structure:

```markdown
# <Title>

## Summary
2-4 sentences: what the feature/change is about, its purpose, and expected impact.

## Technical Overview
1-3 paragraphs covering:
- Core logic, architecture, and flow
- Data models, components, API endpoints, or key files involved
- Dependencies, libraries, or frameworks to use or modify
- Integration points with existing systems

## Implementation Plan

### Phase 1: <Name>
- Step-by-step actions for this phase
- Each step should be concrete and actionable
- Include specific files to create/modify

### Phase 2: <Name>
...

### Phase N: <Name>
...

## Notes / Considerations
- Potential pitfalls, edge cases, or tradeoffs
- Performance implications (if relevant)
- UX/accessibility considerations (if relevant)
- Security concerns (if relevant)
- Migration/backward compatibility needs (if applicable)
```

### Planning rules

- 3-7 phases, ordered logically (setup -> core logic -> integration -> polish)
- Each phase should be completable in roughly 15-30 minutes
- Do NOT include test writing steps
- Do NOT include deployment steps (handled automatically by GitHub)
- Keep the plan practical, technical, and executable in small iterations
- After generating the plan, stop and wait for user review before proceeding

## Execution Mode

When executing a plan (user says "execute phase N", "start phase 1", "continue with the next phase", etc.):

### Execution rules

- Act as a senior developer assistant
- Work strictly within the current phase - do not continue to the next phase until the user reviews and approves
- Focus on clean architecture, code quality, readability, and internal verification
- Do not add, guess, or initiate steps beyond what is explicitly defined for the current phase
- Use critical thinking - if something in the plan seems wrong or could be improved, flag it before implementing
- After implementing a phase, explain how the user can verify it works correctly

**CRITICAL — NEVER mark a phase as completed on your own.** A phase may ONLY be marked as `[COMPLETED]` when the developer explicitly requests it (e.g., "mark it as done", "phase is complete", "mark phase completed"). Finishing implementation does NOT mean the phase is complete — the developer must review, verify, and explicitly tell you to mark it. Violating this rule risks marking unverified work as done.

### Execution workflow

1. Read the plan file from `docs/plans/`
2. Identify the current phase
3. Implement only that phase
4. Report what was done and how to verify
5. Wait for user confirmation before moving to the next phase

### Phase completion

**CRITICAL — This section has TWO mandatory steps. BOTH must be performed every time. Never skip step 2 (commit message generation).**

When the developer explicitly asks to mark a phase as done:

1. Mark the phase as completed in the plan MD file by appending `[COMPLETED]` to the phase heading (e.g., `### Phase 1: Setup [COMPLETED]`)
2. **ALWAYS generate a commit message** — this is NOT optional. Every phase completion MUST include a commit message. Generate a one-line commit message following conventional commit format and present it to the user (do NOT commit yourself):
   - Extract the ticket number from the current git branch name (e.g., branch `fix/TC-199-search-fix` -> `TC-199`)
   - Format: `<type>(TC-XXX): <short summary of what the phase accomplished>`
   - Types: `feat` for new features, `fix` for bug fixes, `refactor` for refactoring, `chore` for maintenance
   - Examples:
     - `feat(TC-143): add comment responder API endpoint and hook`
     - `fix(TC-199): correct full-text search query escaping`
     - `refactor(TC-205): extract shared branding constants`

Reminder: Do NOT mark phases as completed after implementation. Only mark when the developer explicitly requests it. And ALWAYS provide the commit message when marking.

### Updating the plan during execution

If during execution a phase needs adjustment (discovered complexity, better approach), propose the change to the user before implementing it. Update the plan file to reflect any agreed changes.
