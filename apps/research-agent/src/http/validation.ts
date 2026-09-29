import { z } from "zod";

import { isLocalDevelopment } from "@wildfires-org/turboplan-env";
import { assertSafeFetchUrl } from "@wildfires-org/turboplan-utils/ssrf";

import { AGENT_SKILLS } from "../runs/types";

const MAX_PROMPT_LENGTH = 10_000;

/**
 * Callback base URL supplied by the caller. Callbacks carry only the per-run
 * webhookSecret (which the same caller provides), so a hostile URL cannot
 * exfiltrate anything the caller does not already hold. This guard only stops
 * the agent from being used as a blind POST proxy into private networks.
 *
 * Host classification comes from the shared classifier in
 * `@wildfires-org/turboplan-utils/ssrf`, so this stays in step with the map
 * proxy and the MCP server.
 *
 * Loopback (and plain http to it) is accepted ONLY in a local dev process —
 * `isLocalDevelopment()` fails closed, so any deployed environment rejects
 * `http://localhost` and `https://127.0.0.1` alike.
 *
 * Public hostnames that resolve to private ranges (DNS rebinding) are NOT
 * covered here — that is handled by `assertPublicTarget` in
 * `./utils/resolve-guard`, which the run handlers call before starting a run.
 */
const callbackUrlSchema = z
  .string()
  .url("targetApiUrl must be a valid URL")
  .superRefine((value, ctx) => {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      // .url() above has already reported the issue.
      return;
    }

    const guardError = assertSafeFetchUrl(url, {
      label: "targetApiUrl",
      allowLoopback: isLocalDevelopment(),
    });
    if (!guardError) {
      return;
    }

    const message = guardError.includes("credentials")
      ? "targetApiUrl must not contain credentials"
      : guardError.includes("HTTPS")
        ? "targetApiUrl must use https"
        : "targetApiUrl must not point to a private network";

    ctx.addIssue({ code: z.ZodIssueCode.custom, message });
  });

const runBodySchema = z.object({
  prompt: z
    .string()
    .trim()
    .min(1, "prompt is required")
    .max(MAX_PROMPT_LENGTH, `prompt exceeds ${MAX_PROMPT_LENGTH} characters`),
  skill: z.enum(AGENT_SKILLS).optional(),
  projectId: z.string().trim().optional(),
  targetApiUrl: callbackUrlSchema,
  webhookSecret: z.string(),
});

type RunBody = z.infer<typeof runBodySchema>;

type ValidationResult<T> =
  | { ok: true; data: T; error: null }
  | { ok: false; data: null; error: string };

export function validateRunBody(body: unknown): ValidationResult<RunBody> {
  const result = runBodySchema.safeParse(body);

  if (!result.success) {
    const issue = result.error.issues[0];
    const field = issue.path.join(".");
    const message = field
      ? `Field '${field}': ${issue.message}`
      : issue.message;
    return { ok: false, data: null, error: message };
  }

  return { ok: true, data: result.data, error: null };
}

const resumeBodySchema = z
  .object({
    prompt: z
      .string()
      .trim()
      .min(1, "prompt cannot be empty")
      .max(MAX_PROMPT_LENGTH, `prompt exceeds ${MAX_PROMPT_LENGTH} characters`)
      .optional(),
    targetApiUrl: callbackUrlSchema.optional(),
    webhookSecret: z.string().optional(),
  })
  .strict();

type ResumeBody = z.infer<typeof resumeBodySchema>;

export function validateResumeBody(
  body: unknown,
): ValidationResult<ResumeBody> {
  const result = resumeBodySchema.safeParse(body);
  if (!result.success) {
    return { ok: false, data: null, error: result.error.issues[0].message };
  }
  return { ok: true, data: result.data, error: null };
}

const MAX_CONTEXT_LENGTH = 10_000;

const contextBodySchema = z.object({
  context: z
    .string()
    .trim()
    .min(1, "context is required")
    .max(
      MAX_CONTEXT_LENGTH,
      `context exceeds ${MAX_CONTEXT_LENGTH} characters`,
    ),
});

type ContextBody = z.infer<typeof contextBodySchema>;

export function validateContext(body: unknown): ValidationResult<ContextBody> {
  const result = contextBodySchema.safeParse(body);

  if (!result.success) {
    return { ok: false, data: null, error: result.error.issues[0].message };
  }

  return { ok: true, data: result.data, error: null };
}

const MAX_EXTRACT_DOCUMENT_IDS = 100;

const extractDocumentsBodySchema = z
  .object({
    documentIds: z
      .array(z.string().trim().min(1, "documentIds entries cannot be empty"))
      .max(
        MAX_EXTRACT_DOCUMENT_IDS,
        `documentIds exceeds ${MAX_EXTRACT_DOCUMENT_IDS} entries`,
      )
      .optional(),
  })
  .strict();

type ExtractDocumentsBody = z.infer<typeof extractDocumentsBodySchema>;

export function validateExtractDocumentsBody(
  body: unknown,
): ValidationResult<ExtractDocumentsBody> {
  const result = extractDocumentsBodySchema.safeParse(body);

  if (!result.success) {
    return { ok: false, data: null, error: result.error.issues[0].message };
  }

  return { ok: true, data: result.data, error: null };
}
