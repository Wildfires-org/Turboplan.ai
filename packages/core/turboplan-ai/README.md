# @wildfires-org/turboplan-ai

AI prompts and services for TurboPlan.

## Overview

This package provides:

- **Prompt templates** — layered system prompts (base identity, mode prompts, tool descriptions, artifact prompts)
- **Prompt service** — `getPrompt()` resolves prompts from code or, when external prompts are enabled, from the database
- **Model resolution** — `getModel()` / `getImageModel()` resolve OpenRouter models from DB config with env fallbacks
- **Image generation** — Hono router and service functions for AI-generated cover images

## Exports

| Path | Contents |
| --- | --- |
| `.` | Prompt constants and templates, `systemPrompt()`, `getPrompt()`, prompt variable helpers, `ChatMode` |
| `/client` | React hooks: `useEnhanceProjectPrompt`, `useValidateProjectPrompt`, `formatMissingDetails` |
| `/server` | `imageGenerationRouter`, `getModel()`, `getImageModel()`, `autoGenerateProjectCoverImage()`, `autoGenerateTemplateCoverImage()`, re-exported `generateText`/`generateObject` from the `ai` SDK |
| `/services` | Standalone service functions (prompt service, auto image generation) for any backend context |
| `/types` | `Prompt`, `ArtifactKind`, `ChatMode`, `SystemPromptProps`, and related types |

## Usage

### System prompt

```typescript
import { ChatMode, systemPrompt } from "@wildfires-org/turboplan-ai";

const system = await systemPrompt({
  mode: ChatMode.Full,
  projectName: "My Project",
  enabledFeatures: { tasks: true, map: false },
});
```

### Prompt service

```typescript
import { getPrompt } from "@wildfires-org/turboplan-ai";

const prompt = await getPrompt("full-mode");
```

When `USE_EXTERNAL_PROMPTS=true`, prompts are loaded from the database (editable via the admin panel) instead of the TypeScript sources. Seed the database with:

```bash
pnpm --filter @wildfires-org/turboplan-ai seed:prompts
```

Note: with external prompts enabled, editing the prompt TypeScript files does not change runtime behavior — update the DB records instead.

### Image generation routes

Mount the router in a Hono app (already done in `apps/server`):

```typescript
import { imageGenerationRouter } from "@wildfires-org/turboplan-ai/server";

apiRouter.route("/api/ai", imageGenerationRouter);
```

Endpoints:

- `POST /generate-image` — generate an image for a project, office, or organization
- `POST /auto-generate-project-image` — generate and set a project cover image
- `GET /generated-images/:id` — fetch a generated image record
- `DELETE /generated-images/:id` — delete a generated image and its stored file

All routes are RBAC-protected. Generated files are stored via `@wildfires-org/turboplan-upload` (Cloudflare R2).

## Environment Variables

Used by the backend (`apps/server`) — access via `@wildfires-org/turboplan-env`:

- `OPENROUTER_API_KEY` — required for text and image generation
- `OPENROUTER_MODEL_PRIMARY` / `OPENROUTER_MODEL_LITE` — fallback text models when no DB config exists
- `OPENROUTER_MODEL_IMAGE_PRIMARY` / `OPENROUTER_MODEL_IMAGE_LITE` — fallback image models
- `USE_EXTERNAL_PROMPTS` — set to `true` to load prompts from the database

Model IDs configured in the admin panel (AI models settings) take precedence over env fallbacks.

## Package Structure

```
src/
  prompts/    # Prompt text and templates (no business logic)
  core/       # Prompt assembly logic (systemPrompt, variables, task context)
  server/     # Hono routes, model resolution, request validation
  services/   # Prompt service, image generation service
  seed/       # DB prompt seeding script
```
