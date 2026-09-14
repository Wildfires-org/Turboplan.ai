import { generateText } from "ai";
import type { Context } from "hono";
import { Hono } from "hono";

import { getModel } from "@wildfires-org/turboplan-ai/server";
import { getPrompt } from "@wildfires-org/turboplan-ai/services";
import {
  gateCreditsOr402,
  meterAiCall,
  resolveBillingOrgForUser,
} from "@wildfires-org/turboplan-billing/server";

import { createIpRateLimiter } from "../utils/ip-rate-limit.js";
import { sanitizePromptInput } from "../utils/sanitize-prompt-input.js";

const ROUTE_NAME = "validate-prompt";

const CONFIG = {
  REQUEST_TIMEOUT_MS: 10000,
  TEMPERATURE: 0,
} as const;

const validateProjectPromptHandler = async (c: Context) => {
  try {
    const body = await c.req.json();
    const { prompt } = body;

    if (!prompt || typeof prompt !== "string") {
      return c.json(
        { valid: false, feedback: "A project prompt is required." },
        200,
      );
    }

    if (prompt.trim().length === 0) {
      return c.json(
        { valid: false, feedback: "The prompt cannot be empty." },
        200,
      );
    }

    const sanitizedPrompt = sanitizePromptInput(prompt);

    // Credit gate + billing target: authenticated callers bill their personal
    // org. The public mount has no identity — those calls stay unmetered
    // (lite model, 1000-char input cap, per-IP rate limit on the public
    // mount, 10s abort; documented exemption).
    const user = c.get("user") as { userId?: string } | undefined;
    const billingOrgId = user?.userId
      ? await resolveBillingOrgForUser(user.userId)
      : null;
    const blocked = await gateCreditsOr402(c, billingOrgId);
    if (blocked) {
      return blocked;
    }

    let model;
    try {
      model = await getModel("lite");
    } catch {
      // If no AI provider configured, skip validation and allow
      return c.json({ valid: true }, 200);
    }

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("AI request timeout")),
        CONFIG.REQUEST_TIMEOUT_MS,
      ),
    );

    const systemPrompt = await getPrompt("project-create-prompt");

    // Marker-wrapped so the system prompt can treat the text strictly as data
    // (see validatePromptSystemPrompt "INPUT HANDLING"). Input copies of the
    // markers are stripped first so they cannot close the block early.
    const userMessage = `USER_PROMPT_START
${sanitizedPrompt.replace(/USER_PROMPT_(START|END)/g, "")}
USER_PROMPT_END`;

    const generatePromise = generateText({
      model,
      system: systemPrompt,
      prompt: userMessage,
      temperature: CONFIG.TEMPERATURE,
      // Actually cancel on timeout — before this, a race-losing call ran to
      // completion at our cost with no metering.
      abortSignal: AbortSignal.timeout(CONFIG.REQUEST_TIMEOUT_MS),
    });

    // Meter on the generate promise itself, not the race winner — whatever
    // completes gets billed even if the response already timed out.
    void generatePromise
      .then((generation) =>
        meterAiCall({
          billing: billingOrgId
            ? { organizationId: billingOrgId, userId: user?.userId }
            : null,
          source: "prompt_tools",
          usage: generation.usage,
          providerMetadata: generation.providerMetadata,
          metadata: { route: ROUTE_NAME },
        }),
      )
      .catch(() => {});

    const result = await Promise.race([generatePromise, timeoutPromise]);
    const generatedText = result.text.trim();

    try {
      const jsonMatch = generatedText.match(/\{[^{}]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }
      const parsed = JSON.parse(jsonMatch[0]);

      return c.json(
        {
          valid: !!parsed.valid,
          missing: parsed.missing || undefined,
          feedback: parsed.feedback || undefined,
        },
        200,
      );
    } catch {
      // If parsing fails, allow the prompt through
      return c.json({ valid: true }, 200);
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    if (errorMessage.includes("timeout")) {
      // On timeout, allow the prompt through rather than blocking
      return c.json({ valid: true }, 200);
    }

    // On error, allow through rather than blocking project creation
    console.error("[validate-project-prompt] Error:", errorMessage);
    return c.json({ valid: true }, 200);
  }
};

// Private router (requires auth, mounted on private routes)
const validateProjectPromptRouter = new Hono();
validateProjectPromptRouter.post(
  "/validate-prompt",
  validateProjectPromptHandler,
);

// Public router (no auth required, mounted on public routes)
const publicValidateProjectPromptRouter = new Hono();
// Anonymous mount: per-IP rate limit is the only spend control (no identity
// to gate or bill).
const checkPublicRateLimit = createIpRateLimiter({
  windowMs: 60_000,
  maxRequests: 10,
});
publicValidateProjectPromptRouter.post("/validate-prompt", async (c) => {
  if (!checkPublicRateLimit(c)) {
    return c.json(
      { error: "Rate limit exceeded. Please try again later." },
      429,
    );
  }
  return validateProjectPromptHandler(c);
});

export { validateProjectPromptRouter, publicValidateProjectPromptRouter };
