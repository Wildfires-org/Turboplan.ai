---
name: e2e-env-gotchas
description: Non-obvious local E2E environment limits (R2 CORS, no map service, flags off, UI project creation opens an LLM chat) and how specs work around them
metadata:
  type: project
---

Local E2E env facts found 2026-10-29 (verify against `e2e/.env` before relying on them):

- Browser uploads PUT straight to a presigned R2 URL; the shared test bucket's CORS rejects `http://localhost:3000`, so uploads fail silently in the UI. `tests/projects/project-helpers.ts` has `mockStorageUpload(page)` which fakes only that PUT; presign + `POST /api/project-documents` stay real.
- The Python map service (`MAP_SERVICE_URL`, port 9000) is not started by the suite, so GIS uploads fail at `POST /api/maps/process`. `mockMapProcessing(page, {filePath, layerName})` in the same helpers file answers with the GeoJSON fixture; `/api/maps/layers/upload` stays real.
- Signing (`IS_SIGNING_PACKAGE_ENABLED`) is unset and project-context is `false` in `.env`; specs branch with `isModuleEnabled(flag)`.
- Creating a project through the office "New Project" dialog lands on `/chats/<id>` and auto-sends the prompt to the real LLM: call `mockProjectChatApi(page, { chatId: "unused", replyText })` first.
- Context dropzone status rows appear before the upload finishes; wait for "Added to documents" / "layer added to the map" before navigating or the upload is aborted.
- The citizen's personal office is shared by the whole suite; its project list sorts A-Z with 9 per page, so leftover projects push other specs' projects off page one (`tests/projects/project-soft-delete.spec.ts` broke this way). Soft-delete projects you create (`deleteTrackedProjects()` in `afterEach`). Don't create extra offices/orgs for the citizen: `getTestOffice` returns the newest office and org order is unspecified, so it would change other specs' workspace.
- Global setup runs `db:push` on every invocation even with `--no-deps`; `E2E_SKIP_DB_CLEAR=true` only skips the wipe.

**Why:** these cost several debug iterations each; none are visible from reading specs.
**How to apply:** reuse the helpers in `e2e/tests/projects/project-helpers.ts` (or move them to `e2e/utils/` if other areas need them) instead of rediscovering.
