---
name: e2e-app-quirks
description: Non-obvious app behaviours that trip up e2e locators/assertions (sidebar links, chats/new ids, global search location, rejected submissions)
metadata:
  type: project
---

- Scope card locators to `getByRole("main")`: the sidebar "My Projects" list links projects by name too. Card titles are h3 headings.
- `/chats/new` generates the chat id client-side; `mockProjectChatApi` needs a chat id up front, so register it with a dummy id and add a later `page.route` that reads `body.id` from POST /api/chat, persists chat+messages (saveChat/saveMessages), then `route.fallback()`. Sidebar chat list is ordered by updatedAt desc. The chat UI has no rename/delete.
- Global search (`turboplan-search` OmniSearch) exists only on the landing page catalog (`:3002/projects`, `?q=` URL state); input label "Search organizations, offices, and projects". Only public, active, non-template projects in government/env-planner orgs are returned.
- Known app bug (2026-10-29): a rejected submission's project goes back to `draft`, and GET /api/projects/user/submissions returns project.ownershipStatus, so my-submissions shows it as "New" and the Rejected filter never matches. Guarded by `test.fail()` in tests/office-features/submissions-lists.spec.ts.
- Rejected submissions move back to the citizen's office, so they never appear in the gov `citizen-submissions` list.

**Why:** found while writing tests/office-features (2026-10-29).
**How to apply:** check before writing locators/fixtures for these pages; drop the bug note once the endpoint is fixed. Related: [[e2e-parallel-agents]].
