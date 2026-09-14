import { generateText } from "ai";
import { Hono } from "hono";

import { getModel } from "@wildfires-org/turboplan-ai/server";
import { getPrompt } from "@wildfires-org/turboplan-ai/services";
import {
  getActiveGovernmentOffices,
  getActiveGovernmentOrganizations,
} from "@wildfires-org/turboplan-public/queries";

import { createIpRateLimiter } from "../utils/ip-rate-limit.js";

// Configuration constants
const CONFIG = {
  MAX_DESCRIPTION_LENGTH: 500,
  MAX_TITLE_LENGTH: 100,
  MAX_REQUEST_BODY_SIZE: 10000, // 10KB
  REQUEST_TIMEOUT_MS: 15000, // 15 seconds
  RATE_LIMIT_WINDOW_MS: 60 * 1000, // 1 minute
  MAX_REQUESTS_PER_WINDOW: 10,
  MAX_OUTPUT_TOKENS: 200,
  TEMPERATURE: 0.7,
} as const;

const generateTitleRouter = new Hono();

// Per-IP rate limiter. The bucket key comes from cf-connecting-ip only when
// this process actually runs on Cloudflare (see extractClientIP) — off-platform
// that header is client-supplied and rotating it would mint a fresh bucket per
// request, bypassing the limit entirely.
const checkRateLimit = createIpRateLimiter({
  windowMs: CONFIG.RATE_LIMIT_WINDOW_MS,
  maxRequests: CONFIG.MAX_REQUESTS_PER_WINDOW,
});

// Enhanced sanitization to prevent prompt injection
const sanitizeDescription = (description: string): string => {
  return (
    description
      // Remove angle brackets
      .replace(/[<>]/g, "")
      // Remove JSON-like role definitions that could inject prompts
      .replace(/\{[\s\S]*?"role"[\s\S]*?\}/gi, "")
      // Remove role indicators
      .replace(/(system|user|assistant):/gi, "")
      // Remove code blocks
      .replace(/```[\s\S]*?```/g, "")
      // Remove markdown headers/lists that could manipulate structure
      .replace(/^[\s]*[#\-*]/gm, "")
      // Limit consecutive newlines
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      // Enforce max length
      .slice(0, CONFIG.MAX_DESCRIPTION_LENGTH)
  );
};

// Middleware to check request size - ONLY for generate-titles endpoint
// Note: This middleware only applies to routes defined in this router
generateTitleRouter.use("/generate-titles", async (c, next) => {
  const contentLength = c.req.header("content-length");
  if (contentLength && parseInt(contentLength) > CONFIG.MAX_REQUEST_BODY_SIZE) {
    return c.json({ error: "Request body too large" }, 413);
  }
  await next();
});

// Metering exemption: this endpoint is PUBLIC-ONLY (pre-auth signup flow) —
// there is no identity to bill. Exposure is bounded by the lite model, the
// per-IP rate limit above and the input size cap. Revisit if it ever gains an
// authenticated mount.
generateTitleRouter.post("/generate-titles", async (c) => {
  try {
    // Rate limiting (per-IP, cf-connecting-ip based)
    if (!checkRateLimit(c)) {
      return c.json(
        { error: "Rate limit exceeded. Please try again later." },
        429,
      );
    }

    const body = await c.req.json();
    const { description } = body;

    // Validate input
    if (!description || typeof description !== "string") {
      return c.json(
        { error: "Description is required and must be a string" },
        400,
      );
    }

    if (description.trim().length === 0) {
      return c.json({ error: "Description cannot be empty" }, 400);
    }

    // Sanitize and truncate description
    const sanitizedDescription = sanitizeDescription(description);

    // Select model
    const model = await getModel("lite");

    // Generate both titles using AI with timeout
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("AI request timeout")),
        CONFIG.REQUEST_TIMEOUT_MS,
      ),
    );

    // Fetch available organizations and offices for the prompt
    const [organizations, offices] = await Promise.all([
      getActiveGovernmentOrganizations(),
      getActiveGovernmentOffices(),
    ]);

    // Sanitize org/office names for prompt (defense in depth)
    const sanitizeForPrompt = (text: string | null): string =>
      (text || "").replace(/[<>{}[\]"'`]/g, "").slice(0, 100);

    // Format organizations for the prompt - shortName first since that's what the modal displays
    const organizationsText = organizations
      .map((org) => {
        const name = sanitizeForPrompt(org.name);
        const shortName = sanitizeForPrompt(org.shortName);
        return shortName ? `- ${shortName} - ${name}` : `- ${name}`;
      })
      .join("\n");

    // Format offices for the prompt - grouped by organization
    const officesText = offices
      .map((off) => {
        const name = sanitizeForPrompt(off.name);
        const orgName = sanitizeForPrompt(
          off.organizationShortName || off.organizationName,
        );
        return `- ${name} (${orgName})`;
      })
      .join("\n");

    const [systemPrompt, userPrompt] = await Promise.all([
      getPrompt("generate-titles-system"),
      getPrompt("generate-titles-user", {
        description: sanitizedDescription,
        organizations: organizationsText || "No organizations available",
        offices: officesText || "No offices available",
      }),
    ]);

    const generatePromise = generateText({
      model,
      system: systemPrompt,
      prompt: userPrompt,
      temperature: CONFIG.TEMPERATURE,
      maxOutputTokens: CONFIG.MAX_OUTPUT_TOKENS,
      // Actually cancel the provider call on timeout — before this, a
      // race-losing request ran to completion and was billed anyway.
      abortSignal: AbortSignal.timeout(CONFIG.REQUEST_TIMEOUT_MS),
    });

    const result = await Promise.race([generatePromise, timeoutPromise]);
    const generatedText = result.text.trim();

    // Parse JSON response
    let parsedTitles;
    try {
      // More efficient regex for simple JSON objects
      const jsonMatch = generatedText.match(/\{[^{}]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }
      parsedTitles = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error(
        "[generate-titles] JSON parse failed:",
        parseError instanceof Error ? parseError.message : parseError,
        "| raw:",
        JSON.stringify(generatedText),
      );
      return c.json({ error: "Failed to generate valid titles" }, 500);
    }

    // Validate generated titles. Only projectTitle is required; officeTitle and
    // organizationName may be empty when the project location has no matching
    // government office/organization (e.g. locations outside the US).
    if (
      !parsedTitles.projectTitle ||
      typeof parsedTitles.projectTitle !== "string" ||
      parsedTitles.projectTitle.trim().length === 0
    ) {
      console.error(
        "[generate-titles] validation failed - missing/empty projectTitle:",
        JSON.stringify(parsedTitles),
      );
      return c.json({ error: "Failed to generate valid titles" }, 500);
    }

    // Additional validation to detect prompt injection artifacts
    const suspiciousPatterns = [
      "{",
      "}",
      "system:",
      "user:",
      "assistant:",
      "<",
      ">",
    ];
    const isSuspicious = (text: string) =>
      suspiciousPatterns.some((pattern) => text.includes(pattern));

    if (
      isSuspicious(parsedTitles.projectTitle) ||
      (parsedTitles.officeTitle && isSuspicious(parsedTitles.officeTitle)) ||
      (parsedTitles.organizationName &&
        isSuspicious(parsedTitles.organizationName)) ||
      parsedTitles.projectTitle.length > CONFIG.MAX_TITLE_LENGTH ||
      (parsedTitles.officeTitle?.length ?? 0) > CONFIG.MAX_TITLE_LENGTH
    ) {
      console.error("[generate-titles] Suspicious output detected");
      return c.json({ error: "Invalid title generated" }, 500);
    }

    // Ensure titles are reasonable length
    const finalProjectTitle = parsedTitles.projectTitle.trim();
    const finalOfficeTitle = parsedTitles.officeTitle?.trim() || "";
    const finalOrganizationName = parsedTitles.organizationName?.trim() || "";

    return c.json(
      {
        projectTitle: finalProjectTitle,
        officeTitle: finalOfficeTitle,
        organizationName: finalOrganizationName,
      },
      200,
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    console.error("[generate-titles] unhandled error:", error);

    // Different error responses based on error type
    if (errorMessage.includes("timeout")) {
      return c.json(
        {
          error:
            "Request timed out. The AI service is taking longer than expected.",
        },
        504,
      );
    }

    // Generic error response - don't expose internal details
    return c.json(
      { error: "Failed to generate titles. Please try again." },
      500,
    );
  }
});

export { generateTitleRouter };
