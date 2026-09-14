import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { z } from "zod";

import {
  extractVariables,
  getVariablesForPrompt,
  PROMPT_VARIABLES,
} from "@wildfires-org/turboplan-ai";
import type { PromptErrorCode } from "@wildfires-org/turboplan-db/queries";
import {
  createPrompt,
  createPromptVersion,
  deletePromptVersion,
  getAllPrompts,
  getPromptByName,
  PromptError,
  promptExists,
  rollbackPrompt,
  updatePrompt,
} from "@wildfires-org/turboplan-db/queries";
import type { RBACContext } from "@wildfires-org/turboplan-rbac/hono";

const PROMPT_ERROR_STATUS: Record<PromptErrorCode, ContentfulStatusCode> = {
  HARDCODED_VERSION: 403,
  ACTIVE_VERSION: 400,
  LAST_VERSION: 400,
  VERSION_NOT_FOUND: 404,
  PROMPT_NOT_FOUND: 404,
};

const validateRequiredVariables = (
  name: string,
  content: string,
): { valid: true } | { valid: false; missing: string[] } => {
  const applicableVariables = getVariablesForPrompt(name);
  const presentVariables = extractVariables(content);

  const missing = applicableVariables
    .filter((v) => !presentVariables.includes(v.name))
    .map((v) => v.name);

  if (missing.length > 0) {
    return { valid: false, missing };
  }

  return { valid: true };
};

const promptsRouter = new Hono<RBACContext>();

/**
 * GET /
 * List all prompts with their versions.
 */
promptsRouter.get("/", async (c) => {
  try {
    const prompts = await getAllPrompts();
    return c.json({ prompts });
  } catch (error) {
    console.error("Failed to get prompts:", error);
    return c.json({ error: "Failed to get prompts" }, 500);
  }
});

/**
 * GET /variables
 * Get all available variables (for reference).
 */
promptsRouter.get("/variables", (c) => {
  return c.json({ variables: PROMPT_VARIABLES });
});

/**
 * GET /variables/:name
 * Get variables applicable to a specific prompt.
 */
promptsRouter.get("/variables/:name", (c) => {
  const promptName = c.req.param("name");
  const variables = getVariablesForPrompt(promptName);
  return c.json({ variables });
});

/**
 * GET /:name
 * Get a single prompt with all versions.
 */
promptsRouter.get("/:name", async (c) => {
  try {
    const name = c.req.param("name");
    const prompt = await getPromptByName(name);

    if (!prompt) {
      return c.json({ error: "Prompt not found" }, 404);
    }

    return c.json({ prompt });
  } catch (error) {
    console.error("Failed to get prompt:", error);
    return c.json({ error: "Failed to get prompt" }, 500);
  }
});

/**
 * PUT /:name
 * Update a version in-place.
 * Body: { content: string, notes: string | null, version?: number }
 * If version is omitted, updates the active version.
 */
promptsRouter.put(
  "/:name",
  zValidator(
    "json",
    z.object({
      content: z.string().min(1),
      notes: z.string().nullable().optional(),
      version: z.number().optional(),
    }),
  ),
  async (c) => {
    try {
      const name = c.req.param("name");
      const { content, notes, version } = c.req.valid("json");

      const validation = validateRequiredVariables(name, content);
      if (!validation.valid) {
        return c.json(
          { error: "Missing required variables", missing: validation.missing },
          400,
        );
      }

      const updatedPrompt = await updatePrompt({
        name,
        content,
        notes: notes || null,
        ...(typeof version === "number" && { version }),
      });

      if (!updatedPrompt) {
        return c.json({ error: "Prompt not found" }, 404);
      }

      return c.json({ prompt: updatedPrompt });
    } catch (error) {
      if (error instanceof PromptError) {
        return c.json(
          { error: error.message },
          PROMPT_ERROR_STATUS[error.code],
        );
      }
      console.error("Failed to update prompt:", error);
      return c.json({ error: "Failed to update prompt" }, 500);
    }
  },
);

/**
 * POST /:name/versions
 * Create a new version for a prompt and set it as active.
 * Body: { content: string, notes: string | null }
 */
promptsRouter.post(
  "/:name/versions",
  zValidator(
    "json",
    z.object({
      content: z.string().min(1),
      notes: z.string().nullable().optional(),
    }),
  ),
  async (c) => {
    try {
      const name = c.req.param("name");
      const { content, notes } = c.req.valid("json");

      const validation = validateRequiredVariables(name, content);
      if (!validation.valid) {
        return c.json(
          { error: "Missing required variables", missing: validation.missing },
          400,
        );
      }

      const userId = c.get("user").userId;

      const updatedPrompt = await createPromptVersion({
        name,
        content,
        notes: notes || null,
        userId,
      });

      if (!updatedPrompt) {
        return c.json({ error: "Prompt not found" }, 404);
      }

      return c.json({ prompt: updatedPrompt }, 201);
    } catch (error) {
      console.error("Failed to create prompt version:", error);
      return c.json({ error: "Failed to create prompt version" }, 500);
    }
  },
);

/**
 * POST /:name/rollback
 * Rollback a prompt to a specific version.
 * Body: { version: number }
 */
promptsRouter.post(
  "/:name/rollback",
  zValidator("json", z.object({ version: z.number().int().positive() })),
  async (c) => {
    try {
      const name = c.req.param("name");
      const { version } = c.req.valid("json");

      const updatedPrompt = await rollbackPrompt({ name, version });

      if (!updatedPrompt) {
        return c.json({ error: "Prompt not found" }, 404);
      }

      return c.json({ prompt: updatedPrompt });
    } catch (error) {
      if (error instanceof PromptError) {
        return c.json(
          { error: error.message },
          PROMPT_ERROR_STATUS[error.code],
        );
      }
      console.error("Failed to rollback prompt:", error);
      return c.json({ error: "Failed to rollback prompt" }, 500);
    }
  },
);

/**
 * DELETE /:name/versions/:version
 * Delete a specific version of a prompt.
 */
promptsRouter.delete("/:name/versions/:version", async (c) => {
  try {
    const name = c.req.param("name");
    const version = parseInt(c.req.param("version"));

    if (Number.isNaN(version)) {
      return c.json({ error: "Valid version number is required" }, 400);
    }

    const updatedPrompt = await deletePromptVersion({ name, version });

    return c.json({ prompt: updatedPrompt });
  } catch (error) {
    if (error instanceof PromptError) {
      return c.json({ error: error.message }, PROMPT_ERROR_STATUS[error.code]);
    }
    console.error("Failed to delete prompt version:", error);
    return c.json({ error: "Failed to delete prompt version" }, 500);
  }
});

/**
 * POST /
 * Create a new prompt (for seeding/initial setup).
 * Body: { name: string, title: string, description: string | null, content: string }
 */
promptsRouter.post(
  "/",
  zValidator(
    "json",
    z.object({
      name: z.string().min(1),
      title: z.string().min(1),
      description: z.string().nullable().optional(),
      content: z.string().min(1),
    }),
  ),
  async (c) => {
    try {
      const { name, title, description, content } = c.req.valid("json");

      const validation = validateRequiredVariables(name, content);
      if (!validation.valid) {
        return c.json(
          { error: "Missing required variables", missing: validation.missing },
          400,
        );
      }

      const exists = await promptExists(name);
      if (exists) {
        return c.json({ error: "Prompt with this name already exists" }, 409);
      }

      const userId = c.get("user").userId;

      const newPrompt = await createPrompt({
        name,
        title,
        description: description || null,
        content,
        userId,
      });

      return c.json({ prompt: newPrompt }, 201);
    } catch (error) {
      console.error("Failed to create prompt:", error);
      return c.json({ error: "Failed to create prompt" }, 500);
    }
  },
);

export { promptsRouter };
