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

const ROUTE_NAME = "enhance-prompt";

const CONFIG = {
  REQUEST_TIMEOUT_MS: 10000,
  TEMPERATURE: 0.3,
} as const;

const enhanceProjectPromptHandler = async (c: Context) => {
  try {
    const body = await c.req.json();
    const { prompt, missing } = body;

    if (!prompt || typeof prompt !== "string") {
      return c.json({ enhancedPrompt: null }, 200);
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
      return c.json({ enhancedPrompt: null }, 200);
    }

    const systemPrompt = await getPrompt("project-enhance-prompt");

    const missingAreas = Array.isArray(missing) ? missing.join(", ") : "";
    const userMessage = `Missing areas: ${missingAreas}\nPrompt: ${sanitizedPrompt}`;

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("AI request timeout")),
        CONFIG.REQUEST_TIMEOUT_MS,
      ),
    );

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

    return c.json({ enhancedPrompt: result.text.trim() }, 200);
  } catch (error) {
    console.error("[enhance-project-prompt] Error:", error);
    return c.json({ enhancedPrompt: null }, 200);
  }
};

// Private router (requires auth, mounted on private routes)
const enhanceProjectPromptRouter = new Hono();
enhanceProjectPromptRouter.post("/enhance-prompt", enhanceProjectPromptHandler);

// Public router (no auth required, mounted on public routes)
const publicEnhanceProjectPromptRouter = new Hono();
// Anonymous mount: per-IP rate limit is the only spend control (no identity
// to gate or bill).
const checkPublicRateLimit = createIpRateLimiter({
  windowMs: 60_000,
  maxRequests: 10,
});
publicEnhanceProjectPromptRouter.post("/enhance-prompt", async (c) => {
  if (!checkPublicRateLimit(c)) {
    return c.json(
      { error: "Rate limit exceeded. Please try again later." },
      429,
    );
  }
  return enhanceProjectPromptHandler(c);
});

export { enhanceProjectPromptRouter, publicEnhanceProjectPromptRouter };
