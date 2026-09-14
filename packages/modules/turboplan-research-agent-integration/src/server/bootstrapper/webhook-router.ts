import { randomUUID } from "node:crypto";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { createMiddleware } from "hono/factory";

import {
  isDocumentsPackageEnabled,
  isFieldsPackageEnabled,
  isTasksPackageEnabled,
  isTimelineRecordsPackageEnabled,
} from "@wildfires-org/turboplan-feature-flags";
import type { RBACContext } from "@wildfires-org/turboplan-rbac/hono";
import { getProjectById } from "@wildfires-org/turboplan-workspace/server";

import type {
  ResearchAgentChat,
  ResearchAgentMessageTypeValue,
} from "../../types";
import { ResearchAgentChatStatus, ResearchAgentMessageType } from "../../types";
import {
  appendOrCreateRunArrayMessage,
  createResearchAgentMessage,
  getResearchAgentChatByWebhookSecret,
  updateResearchAgentChatByExternalId,
} from "../repository";
import {
  bootstrapperAddContextSchema,
  bootstrapperAddDocumentsSchema,
  bootstrapperAddFieldsSchema,
  bootstrapperAddMilestonesSchema,
  bootstrapperAddTimelineSchema,
  bootstrapperProgressSchema,
} from "../schemas";
import { handleRouteError } from "../utils";
import { webhookLoggerMiddleware } from "../webhook-logger-middleware";
import { generateSuggestionsFromMilestones } from "./service";

type WebhookContext = RBACContext & {
  Variables: RBACContext["Variables"] & {
    researchAgentChat: ResearchAgentChat;
    webhookProjectId: string | null;
  };
};

const webhookSecretMiddleware = createMiddleware<WebhookContext>(
  async (c, next) => {
    const secret = c.req.header("x-webhook-secret");
    if (!secret) {
      return c.json({ error: "Unauthorized - Missing webhook secret" }, 401);
    }

    const record = await getResearchAgentChatByWebhookSecret(secret);
    if (!record) {
      return c.json({ error: "Unauthorized - Invalid webhook secret" }, 401);
    }

    c.set("researchAgentChat", record);
    c.set("webhookProjectId", record.projectId ?? null);
    await next();
  },
);

const bootstrapperWebhookRouter = new Hono<WebhookContext>();

bootstrapperWebhookRouter.use("/*", webhookSecretMiddleware);
// Registered AFTER the secret check on purpose: logging an unauthenticated
// request would let anyone write rows into webhook_request_log.
bootstrapperWebhookRouter.use("/*", webhookLoggerMiddleware);

/**
 * Thin adapter over the repository's atomic appender. The agent sends a type in
 * multiple batches (e.g. one documents POST per reference project) and the panel
 * renders only the latest row per type, so all batches for a run must land in
 * one row. See appendOrCreateRunArrayMessage for the concurrency/dedupe guards.
 */
const appendOrCreateArrayMessage = <T>(params: {
  record: ResearchAgentChat;
  type: ResearchAgentMessageTypeValue;
  key: "documents" | "fields" | "context" | "timeline";
  items: T[];
  dedupeKey: (item: T) => string | null;
}): Promise<void> => {
  const { record, type, key, items, dedupeKey } = params;
  return appendOrCreateRunArrayMessage({
    chatId: record.chatId,
    researchAgentChatId: record.id,
    type,
    key,
    items,
    dedupeKey,
  });
};

// POST /project/progress - Receive progress update from research agent
bootstrapperWebhookRouter.post(
  "/project/progress",
  zValidator("json", bootstrapperProgressSchema),
  async (c) => {
    try {
      const { runId, message } = c.req.valid("json");
      const researchAgentRecord = c.get("researchAgentChat");

      if (researchAgentRecord.externalRunId !== runId) {
        return c.json({ error: "Forbidden - Run ID mismatch" }, 403);
      }

      await updateResearchAgentChatByExternalId({
        externalRunId: runId,
        status: ResearchAgentChatStatus.RUNNING,
        currentStep: message,
      });

      await createResearchAgentMessage({
        chatId: researchAgentRecord.chatId,
        researchAgentChatId: researchAgentRecord.id,
        type: ResearchAgentMessageType.PROGRESS,
        data: { step: message },
      });

      return c.json({ success: true });
    } catch (error) {
      return handleRouteError(c, "bootstrapper-webhook-progress", error);
    }
  },
);

// POST /project/documents - Receive documents from research agent
bootstrapperWebhookRouter.post(
  "/project/documents",
  zValidator("json", bootstrapperAddDocumentsSchema),
  async (c) => {
    try {
      if (!isDocumentsPackageEnabled()) {
        return c.json({ success: true, skipped: true });
      }

      const { projectId, documents } = c.req.valid("json");
      const researchAgentRecord = c.get("researchAgentChat");

      const webhookProjectId = c.get("webhookProjectId");
      if (!webhookProjectId || webhookProjectId !== projectId) {
        return c.json({ error: "Forbidden - Project ID mismatch" }, 403);
      }

      const documentsWithState = documents.map((doc) => ({
        ...doc,
        saved: false,
      }));

      await appendOrCreateArrayMessage({
        record: researchAgentRecord,
        type: ResearchAgentMessageType.DOCUMENTS,
        key: "documents",
        items: documentsWithState,
        dedupeKey: (doc) => doc.url ?? null,
      });

      return c.json({ success: true });
    } catch (error) {
      return handleRouteError(c, "bootstrapper-webhook-documents", error);
    }
  },
);

// POST /project/milestones - Receive milestones from research agent
bootstrapperWebhookRouter.post(
  "/project/milestones",
  zValidator("json", bootstrapperAddMilestonesSchema),
  async (c) => {
    try {
      if (!isTasksPackageEnabled()) {
        return c.json({ success: true, skipped: true });
      }

      const { projectId, milestones } = c.req.valid("json");
      const researchAgentRecord = c.get("researchAgentChat");

      const webhookProjectId = c.get("webhookProjectId");
      if (!webhookProjectId || webhookProjectId !== projectId) {
        return c.json({ error: "Forbidden - Project ID mismatch" }, 403);
      }

      const milestonesWithState = milestones.map((m) => ({
        artifactId: randomUUID(),
        ...m,
        saved: false,
        tasks: m.tasks.map((task) => ({
          artifactId: randomUUID(),
          ...task,
          saved: false,
        })),
      }));

      await createResearchAgentMessage({
        chatId: researchAgentRecord.chatId,
        researchAgentChatId: researchAgentRecord.id,
        type: ResearchAgentMessageType.MILESTONES,
        data: { milestones: milestonesWithState },
      });

      if (webhookProjectId) {
        const project = await getProjectById(webhookProjectId);
        if (project) {
          generateSuggestionsFromMilestones({
            chatId: researchAgentRecord.chatId,
            researchAgentChatId: researchAgentRecord.id,
            milestones: milestonesWithState,
            projectName: project.name,
          }).catch((err) => {
            console.error(
              "Failed to generate suggestions from milestones:",
              err,
            );
          });
        }
      }

      return c.json({ success: true });
    } catch (error) {
      return handleRouteError(c, "bootstrapper-webhook-milestones", error);
    }
  },
);

// POST /project/fields - Receive fields from research agent
bootstrapperWebhookRouter.post(
  "/project/fields",
  zValidator("json", bootstrapperAddFieldsSchema),
  async (c) => {
    try {
      if (!isFieldsPackageEnabled()) {
        return c.json({ success: true, skipped: true });
      }

      const { projectId, fields } = c.req.valid("json");
      const researchAgentRecord = c.get("researchAgentChat");

      const webhookProjectId = c.get("webhookProjectId");
      if (!webhookProjectId || webhookProjectId !== projectId) {
        return c.json({ error: "Forbidden - Project ID mismatch" }, 403);
      }

      const fieldsWithState = fields.map((f) => ({
        ...f,
        saved: false,
      }));

      await appendOrCreateArrayMessage({
        record: researchAgentRecord,
        type: ResearchAgentMessageType.FIELDS,
        key: "fields",
        items: fieldsWithState,
        dedupeKey: (field) => `${field.label}::${field.value}`,
      });

      return c.json({ success: true });
    } catch (error) {
      return handleRouteError(c, "bootstrapper-webhook-fields", error);
    }
  },
);

// POST /project/context - Receive context entries from research agent
bootstrapperWebhookRouter.post(
  "/project/context",
  zValidator("json", bootstrapperAddContextSchema),
  async (c) => {
    try {
      const { projectId, context } = c.req.valid("json");
      const researchAgentRecord = c.get("researchAgentChat");

      const webhookProjectId = c.get("webhookProjectId");
      if (!webhookProjectId || webhookProjectId !== projectId) {
        return c.json({ error: "Forbidden - Project ID mismatch" }, 403);
      }

      const contextWithState = context.map((item) => ({
        ...item,
        saved: false,
      }));

      await appendOrCreateArrayMessage({
        record: researchAgentRecord,
        type: ResearchAgentMessageType.CONTEXT,
        key: "context",
        items: contextWithState,
        dedupeKey: (item) => `${item.label}::${item.content}`,
      });

      return c.json({ success: true });
    } catch (error) {
      return handleRouteError(c, "bootstrapper-webhook-context", error);
    }
  },
);

// POST /project/timeline - Receive timeline from research agent
bootstrapperWebhookRouter.post(
  "/project/timeline",
  zValidator("json", bootstrapperAddTimelineSchema),
  async (c) => {
    try {
      if (!isTimelineRecordsPackageEnabled()) {
        return c.json({ success: true, skipped: true });
      }

      const { projectId, timeline } = c.req.valid("json");
      const researchAgentRecord = c.get("researchAgentChat");

      const webhookProjectId = c.get("webhookProjectId");
      if (!webhookProjectId || webhookProjectId !== projectId) {
        return c.json({ error: "Forbidden - Project ID mismatch" }, 403);
      }

      const timelineWithState = timeline.map((item) => ({
        ...item,
        saved: false,
      }));

      await appendOrCreateArrayMessage({
        record: researchAgentRecord,
        type: ResearchAgentMessageType.TIMELINE,
        key: "timeline",
        items: timelineWithState,
        dedupeKey: (item) => `${item.title}::${item.startedAt ?? ""}`,
      });

      return c.json({ success: true });
    } catch (error) {
      return handleRouteError(c, "bootstrapper-webhook-timeline", error);
    }
  },
);

export default bootstrapperWebhookRouter;
