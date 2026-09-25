import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import * as Sentry from "@sentry/cloudflare";

import { hashPAT, isPATToken } from "@wildfires-org/turboplan-api-client";
import { runWithWorkerConnection } from "@wildfires-org/turboplan-db/db-client";
import {
  findPATByHash,
  updatePATLastUsed,
} from "@wildfires-org/turboplan-db/queries";

import { createServer } from "./server.js";
import {
  exceedsUploadCallLimit,
  extractToolCall,
  getToolCallCharge,
  MAX_UPLOAD_CALLS_PER_REQUEST,
  type ToolCall,
} from "./utils/request-charges.js";
import type { McpUserContext } from "./utils/types.js";

type Env = {
  POSTGRES_URL: string;
  AUTH_SECRET: string;
  ADMIN_EMAILS: string;
  WORKER_RUNTIME: string;
  TURBOPLAN_URL: string;
  LANDING_URL: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  R2_ACCOUNT_ID: string;
  R2_BUCKET_NAME: string;
  R2_PUBLIC_URL: string;
  OPENROUTER_API_KEY: string;
  OPENROUTER_MODEL_IMAGE_PRIMARY: string;
  OPENROUTER_MODEL_IMAGE_LITE: string;
  IS_TASKS_PACKAGE_ENABLED: string;
  IS_FIELDS_PACKAGE_ENABLED: string;
  IS_MAPS_PACKAGE_ENABLED: string;
  IS_DOCUMENTS_PACKAGE_ENABLED: string;
  IS_TIMELINE_RECORDS_PACKAGE_ENABLED: string;
  IS_PROJECT_CONTEXT_PACKAGE_ENABLED: string;
  IS_RESEARCH_AGENT_INTEGRATION_PACKAGE_ENABLED: string;
  ENVIRONMENT?: string;
  SENTRY_DSN?: string;
  RELEASE_VERSION?: string;
  POSTHOG_API_KEY?: string;
  RATE_LIMITER_READ: RateLimit;
  RATE_LIMITER_WRITE: RateLimit;
  RATE_LIMITER_GLOBAL: RateLimit;
};

const ENV_BRIDGE_KEYS = [
  "POSTGRES_URL",
  "AUTH_SECRET",
  "ADMIN_EMAILS",
  "WORKER_RUNTIME",
  "TURBOPLAN_URL",
  "LANDING_URL",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_ACCOUNT_ID",
  "R2_BUCKET_NAME",
  "R2_PUBLIC_URL",
  "OPENROUTER_API_KEY",
  "OPENROUTER_MODEL_IMAGE_PRIMARY",
  "OPENROUTER_MODEL_IMAGE_LITE",
  "IS_TASKS_PACKAGE_ENABLED",
  "IS_FIELDS_PACKAGE_ENABLED",
  "IS_MAPS_PACKAGE_ENABLED",
  "IS_DOCUMENTS_PACKAGE_ENABLED",
  "IS_TIMELINE_RECORDS_PACKAGE_ENABLED",
  "IS_PROJECT_CONTEXT_PACKAGE_ENABLED",
  "IS_RESEARCH_AGENT_INTEGRATION_PACKAGE_ENABLED",
  // Sentry error monitoring — optional, monitoring disabled when unset
  "SENTRY_DSN",
] as const;

const MAX_BODY_SIZE = 1024 * 1024;
const MCP_PATH = "/mcp";
const WRITE_TOOL_PREFIXES = [
  "create_",
  "update_",
  "delete_",
  "upload_",
  "add_",
  "move_",
  "remove_",
];

const jsonResponse = (
  body: Record<string, unknown>,
  status: number,
  headers?: Record<string, string>,
): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });

const validatePAT = async (
  request: Request,
): Promise<{ user: McpUserContext } | { error: Response }> => {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return { error: jsonResponse({ error: "Missing authentication" }, 401) };
  }

  if (!isPATToken(token)) {
    return { error: jsonResponse({ error: "Invalid token format" }, 401) };
  }

  const hash = hashPAT(token);
  const pat = await findPATByHash(hash);
  if (!pat) {
    return { error: jsonResponse({ error: "Invalid token" }, 401) };
  }

  await updatePATLastUsed(pat.id).catch((err) =>
    console.error("Failed to update PAT lastUsedAt:", err),
  );

  return {
    user: {
      userId: pat.userId,
      email: pat.email,
      actor: pat.actor,
      patId: pat.id,
      userRole: pat.userRole ?? undefined,
    },
  };
};

const bridgeEnv = (env: Env) => {
  for (const key of ENV_BRIDGE_KEYS) {
    const value = env[key];
    if (typeof value === "string") {
      process.env[key] = value;
    }
  }
};

/**
 * PostHog capture via raw HTTP — posthog-node's buffering doesn't fit
 * stateless Workers. Fired through ctx.waitUntil so it never delays the
 * response; no-ops when POSTHOG_API_KEY is unset.
 */
const capturePosthogEvent = (
  env: Env,
  ctx: ExecutionContext,
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>,
) => {
  if (!env.POSTHOG_API_KEY) {
    return;
  }
  ctx.waitUntil(
    fetch("https://us.i.posthog.com/i/v0/e/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: env.POSTHOG_API_KEY,
        distinct_id: distinctId,
        event,
        properties: { service: "mcp", ...properties },
      }),
    })
      .then((response) => {
        if (!response.ok) {
          console.error(
            `PostHog capture rejected (${response.status}) for event "${event}"`,
          );
        }
      })
      .catch((error) => {
        console.error("PostHog capture failed:", error);
      }),
  );
};

const SENSITIVE_SENTRY_HEADERS = ["authorization", "cookie", "set-cookie"];

// PII scrub: every MCP request carries a PAT in the Authorization header —
// never send it to Sentry.
const scrubSentryEvent = <T extends Sentry.ErrorEvent>(event: T): T => {
  if (event.request) {
    // Request bodies can carry tokens — never send them.
    event.request.data = undefined;
  }
  const headers = event.request?.headers;
  if (headers) {
    for (const header of Object.keys(headers)) {
      if (SENSITIVE_SENTRY_HEADERS.includes(header.toLowerCase())) {
        delete headers[header];
      }
    }
  }
  return event;
};

export default Sentry.withSentry(
  (env: Env) => ({
    dsn: env.SENTRY_DSN || undefined,
    environment: env.ENVIRONMENT,
    release: env.RELEASE_VERSION || undefined,
    tracesSampleRate: 0,
    sendDefaultPii: false,
    initialScope: { tags: { service: "mcp" } },
    beforeSend: scrubSentryEvent,
  }),
  {
    async fetch(
      request: Request,
      env: Env,
      ctx: ExecutionContext,
    ): Promise<Response> {
      bridgeEnv(env);

      const url = new URL(request.url);

      if (url.pathname === "/health") {
        return jsonResponse(
          { status: "ok", name: "turboplan-catalog", version: "0.1.0" },
          200,
        );
      }

      if (url.pathname !== MCP_PATH) {
        return jsonResponse({ error: "Not found" }, 404);
      }

      const method = request.method.toUpperCase();

      if (method !== "POST") {
        return jsonResponse({ error: "Method not allowed" }, 405);
      }

      const contentType = request.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        return jsonResponse(
          { error: "Content-Type must be application/json" },
          415,
        );
      }

      const contentLength = request.headers.get("content-length");
      if (contentLength !== null) {
        const declared = Number.parseInt(contentLength, 10);
        if (Number.isNaN(declared) || declared > MAX_BODY_SIZE) {
          return jsonResponse({ error: "Request body too large" }, 413);
        }
      }

      const clientIp = request.headers.get("cf-connecting-ip") ?? "unknown";
      const { success: withinLimit } = await env.RATE_LIMITER_GLOBAL.limit({
        key: clientIp,
      });
      if (!withinLimit) {
        console.warn(
          JSON.stringify({
            event: "rate_limited",
            ip: clientIp,
            timestamp: new Date().toISOString(),
          }),
        );
        return jsonResponse({ error: "Rate limit exceeded" }, 429);
      }

      try {
        const authResult = await runWithWorkerConnection(() =>
          validatePAT(request),
        );
        if ("error" in authResult) {
          return authResult.error;
        }

        const body = await request.text();
        if (body.length > MAX_BODY_SIZE) {
          return jsonResponse({ error: "Request body too large" }, 413);
        }

        let parsedBody: unknown;
        try {
          parsedBody = JSON.parse(body);
        } catch {
          return jsonResponse({ error: "Invalid JSON" }, 400);
        }

        // JSON-RPC allows batches (an array of requests). Classifying only the
        // top-level object left a batch as toolName=null → the cheap READ
        // bucket, so N writes cost one token. Inspect every element.
        const elements = Array.isArray(parsedBody) ? parsedBody : [parsedBody];
        // Every tools/call in the batch, in order. Reporting only elements[0]
        // undercounted analytics for batched calls.
        const toolCalls = elements
          .map(extractToolCall)
          .filter((call): call is ToolCall => call !== null);
        const toolNames = toolCalls.map((call) => call.name);
        const mcpMethod =
          typeof (elements[0] as Record<string, unknown> | null)?.method ===
          "string"
            ? String((elements[0] as Record<string, unknown>).method)
            : "unknown";

        // The SDK dispatches batch elements concurrently; several uploads in
        // one request would hold several files in isolate memory at once.
        // Rejected before charging so the caller keeps its quota.
        if (exceedsUploadCallLimit(toolCalls)) {
          return jsonResponse(
            {
              jsonrpc: "2.0",
              id: null,
              error: {
                code: -32600,
                message: `At most ${MAX_UPLOAD_CALLS_PER_REQUEST} upload_* tool call per request. Send uploads as separate requests.`,
              },
            },
            400,
          );
        }

        const isWriteTool = (name: string): boolean =>
          WRITE_TOOL_PREFIXES.some((prefix) => name.startsWith(prefix));

        // Charge limiter tokens PER ITEM, not per HTTP request: each tools/call
        // costs 1 token, bulk tools cost one per item they create (capped),
        // so a batch or a bulk call cannot bypass the per-operation quota.
        // Non-tools/call requests (initialize, tools/list, ...) charge one
        // READ token. Stops at the first rejected token.
        const opCharges: Array<{ isWrite: boolean; tokens: number }> =
          toolCalls.length > 0
            ? toolCalls.map((call) => ({
                isWrite: isWriteTool(call.name),
                tokens: getToolCallCharge(call),
              }))
            : [{ isWrite: false, tokens: 1 }];
        for (const charge of opCharges) {
          const opLimiter = charge.isWrite
            ? env.RATE_LIMITER_WRITE
            : env.RATE_LIMITER_READ;
          for (let i = 0; i < charge.tokens; i++) {
            const { success: opWithinLimit } = await opLimiter.limit({
              key: authResult.user.userId,
            });
            if (!opWithinLimit) {
              console.warn(
                JSON.stringify({
                  event: "rate_limited",
                  userId: authResult.user.userId,
                  type: charge.isWrite ? "write" : "read",
                  batchSize: toolNames.length,
                  itemCharge: charge.tokens,
                  timestamp: new Date().toISOString(),
                }),
              );
              return jsonResponse({ error: "Rate limit exceeded" }, 429);
            }
          }
        }

        console.log(
          JSON.stringify({
            event: "mcp_request",
            userId: authResult.user.userId,
            actor: authResult.user.actor,
            method: mcpMethod,
            timestamp: new Date().toISOString(),
          }),
        );

        // One event per tools/call element so a batch of N calls counts as N.
        for (const name of toolNames) {
          capturePosthogEvent(
            env,
            ctx,
            authResult.user.userId,
            "mcp_tool_called",
            {
              tool_name: name,
              is_write: isWriteTool(name),
              source: "mcp",
              batch_size: toolNames.length,
            },
          );
        }

        const server = createServer(authResult.user, {
          publicUrl: env.R2_PUBLIC_URL,
        });
        const transport = new WebStandardStreamableHTTPServerTransport({
          sessionIdGenerator: undefined,
        });

        await server.connect(transport);
        return transport.handleRequest(request, { parsedBody });
      } catch (err) {
        console.error(
          JSON.stringify({
            event: "mcp_error",
            error: String(err),
            timestamp: new Date().toISOString(),
          }),
        );
        // Explicit capture — this catch swallows the error before the
        // withSentry wrapper can see it. No-ops when SENTRY_DSN is unset.
        Sentry.captureException(err);
        return jsonResponse({ error: "Internal server error" }, 500);
      }
    },
  },
);
