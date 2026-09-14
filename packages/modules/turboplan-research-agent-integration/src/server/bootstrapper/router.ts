import { randomBytes } from "node:crypto";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import {
  consumeCredits,
  gateCreditsOr402,
  resolveBillingOrgForProject,
} from "@wildfires-org/turboplan-billing/server";
import { CATALOG } from "@wildfires-org/turboplan-billing/types";
import { runWithWorkerConnection } from "@wildfires-org/turboplan-db/db-client";
import { getMessagesByChatId } from "@wildfires-org/turboplan-db/queries";
import { getApiEnv } from "@wildfires-org/turboplan-env";
import {
  isDocumentsPackageEnabled,
  isFieldsPackageEnabled,
  isTasksPackageEnabled,
  isTimelineRecordsPackageEnabled,
} from "@wildfires-org/turboplan-feature-flags";
import { Action, EntityType } from "@wildfires-org/turboplan-rbac";
import {
  type RBACContext,
  requirePermission,
} from "@wildfires-org/turboplan-rbac/hono";
import { getProjectById } from "@wildfires-org/turboplan-workspace/server";

import type {
  DocumentsMessageData,
  ResearchAgentMessageTypeValue,
} from "../../types";
import { ResearchAgentChatStatus, ResearchAgentMessageType } from "../../types";
import {
  countProgressMessagesByChatId,
  createResearchAgentChat,
  createResearchAgentMessage,
  getActiveResearchAgentChatByChatId,
  getChatByProjectId,
  getResearchAgentChatByChatId,
  getResearchAgentMessageByIdAndProjectId,
  getResearchAgentMessagesByChatId,
  resetResearchAgentChatForRetry,
  updateResearchAgentChatStatus,
} from "../repository";
import { saveMilestonesToProjectSchema, saveToProjectSchema } from "../schemas";
import { handleRouteError } from "../utils";
import {
  forwardNewMessagesToResearchAgent,
  reconcileExternalStatus,
  reconcileSavedMilestonesInMessages,
  resolveDocumentPreviewUrl,
  SaveError,
  saveContextToProject,
  saveDocumentsToProject,
  saveFieldsToProject,
  saveMilestonesToProject,
  saveTimelineToProject,
  startResearchAgent,
} from "./service";

const isMessageTypeEnabled = (type: ResearchAgentMessageTypeValue): boolean => {
  switch (type) {
    case ResearchAgentMessageType.FIELDS:
      return isFieldsPackageEnabled();
    case ResearchAgentMessageType.MILESTONES:
      return isTasksPackageEnabled();
    case ResearchAgentMessageType.DOCUMENTS:
      return isDocumentsPackageEnabled();
    case ResearchAgentMessageType.TIMELINE:
      return isTimelineRecordsPackageEnabled();
    case ResearchAgentMessageType.CONTEXT:
    case ResearchAgentMessageType.PROGRESS:
    case ResearchAgentMessageType.SUGGESTIONS:
      return true;
    default:
      return false;
  }
};

const bootstrapperRouter = new Hono<RBACContext>();

const projectParams = z.object({ projectId: z.string().uuid() });
const projectMessageParams = projectParams.extend({
  messageId: z.string().uuid(),
});

// POST /project/:projectId/start - Start bootstrapper for a project
bootstrapperRouter.post(
  "/project/:projectId/start",
  zValidator("param", projectParams),
  requirePermission(
    EntityType.PROJECT,
    Action.UPDATE,
    (c) => c.req.param("projectId")!,
  ),
  async (c) => {
    try {
      const projectId = c.req.param("projectId")!;

      // Skip the external research-agent run under E2E/CI (NODE_ENV=test).
      // Creating a project auto-POSTs /start (add-project-dialog), which would
      // otherwise spawn a real deployed agent run (Modal + Claude) — burning
      // tokens for no value, and failing anyway since the test callback URL is
      // localhost. Webhook routes stay mounted, so research-agent webhook tests
      // are unaffected.
      if (getApiEnv().NODE_ENV === "test") {
        return c.json({
          skipped: true,
          reason: "Research agent disabled in test environment",
        });
      }

      const project = await getProjectById(projectId);
      if (!project) {
        return c.json({ error: "Project not found" }, 404);
      }

      const chatRecord = await getChatByProjectId(projectId);
      if (!chatRecord) {
        return c.json({ error: "No chat found for project" }, 404);
      }

      const chatId = chatRecord.id;

      // Check for existing active research agent chat
      const existingActiveChat =
        await getActiveResearchAgentChatByChatId(chatId);
      if (existingActiveChat) {
        return c.json({
          runId: existingActiveChat.id,
          externalRunId: existingActiveChat.externalRunId,
          status: existingActiveChat.status,
          message: "Research agent already in progress",
        });
      }

      // Check any existing record (chat_id is unique in DB)
      const existingChat = await getResearchAgentChatByChatId(chatId);
      if (existingChat?.status === ResearchAgentChatStatus.COMPLETED) {
        return c.json({
          runId: existingChat.id,
          externalRunId: existingChat.externalRunId,
          status: existingChat.status,
          message: "Research agent already completed",
        });
      }

      // Credit gate AFTER the dedup checks (a no-op restart must not charge)
      // and BEFORE any record is created. The external run (Modal + Claude)
      // reports no usage back, so it bills a flat catalog cost at start.
      const billingOrgId = await resolveBillingOrgForProject(projectId);
      const blocked = await gateCreditsOr402(
        c,
        billingOrgId,
        CATALOG.billing.flat_credit_costs.research_agent_bootstrap,
      );
      if (blocked) {
        return blocked;
      }

      const webhookSecret = randomBytes(32).toString("hex");
      let researchAgentRecord = null;

      if (
        existingChat &&
        (existingChat.status === ResearchAgentChatStatus.FAILED ||
          existingChat.status === ResearchAgentChatStatus.CANCELLED)
      ) {
        // Retry path: only transition failed/cancelled records back to initializing.
        researchAgentRecord = await resetResearchAgentChatForRetry({
          chatId,
          webhookSecret,
        });
      } else {
        researchAgentRecord = await createResearchAgentChat({
          chatId,
          webhookSecret,
        });
      }

      // Duplicate/concurrent start requests can race. If we didn't get a writable record,
      // return the latest state instead of failing with a DB unique violation.
      if (!researchAgentRecord) {
        const latestChat = await getResearchAgentChatByChatId(chatId);
        if (latestChat) {
          return c.json({
            runId: latestChat.id,
            externalRunId: latestChat.externalRunId,
            status: latestChat.status,
            message:
              latestChat.status === ResearchAgentChatStatus.COMPLETED
                ? "Research agent already completed"
                : "Research agent already in progress",
          });
        }

        throw new Error(
          "Unable to create or reuse research agent run for this chat",
        );
      }

      await updateResearchAgentChatStatus({
        chatId,
        status: ResearchAgentChatStatus.INITIALIZING,
        currentStep: `Starting research for "${project.name}"...`,
      });

      // Charge the flat run cost now that a run WILL start (a retry of a
      // failed run is a fresh external run and bills again).
      if (billingOrgId) {
        const user = c.get("user");
        await consumeCredits({
          organizationId: billingOrgId,
          userId: user?.userId,
          amount: CATALOG.billing.flat_credit_costs.research_agent_bootstrap,
          source: "research_agent",
          metadata: { projectId, runId: researchAgentRecord.id },
        }).catch((error: unknown) => {
          console.error(
            "[billing] research agent credit consumption failed:",
            error,
          );
        });
      }

      // Load chat messages so research agent has conversation context
      const chatMessages = await getMessagesByChatId({ id: chatId });

      const backgroundTask = runWithWorkerConnection(() =>
        startResearchAgent({
          chatId,
          projectId,
          projectName: project.name,
          projectDescription: project.description ?? project.prompt,
          chatMessages,
          webhookSecret,
        }),
      );
      try {
        c.executionCtx.waitUntil(backgroundTask);
      } catch (err) {
        console.warn("waitUntil unavailable, falling back:", err);
        backgroundTask.catch((bgErr) =>
          console.error("Background task failed:", bgErr),
        );
      }

      return c.json({
        runId: researchAgentRecord.id,
        status: "initializing",
      });
    } catch (error) {
      return handleRouteError(c, "bootstrapper", error);
    }
  },
);

// GET /project/:projectId/status - Get status for a project's research agent
bootstrapperRouter.get(
  "/project/:projectId/status",
  zValidator("param", projectParams),
  requirePermission(
    EntityType.PROJECT,
    Action.READ,
    (c) => c.req.param("projectId")!,
  ),
  async (c) => {
    try {
      const projectId = c.req.param("projectId")!;

      const chatRecord = await getChatByProjectId(projectId);
      if (!chatRecord) {
        return c.json({ hasActiveRun: false });
      }

      const chatId = chatRecord.id;
      const researchAgentRecord = await getResearchAgentChatByChatId(chatId);

      if (!researchAgentRecord) {
        return c.json({ hasActiveRun: false });
      }

      const stepsCount = await countProgressMessagesByChatId(chatId);

      let isActive =
        researchAgentRecord.status === ResearchAgentChatStatus.INITIALIZING ||
        researchAgentRecord.status === ResearchAgentChatStatus.QUEUED ||
        researchAgentRecord.status === ResearchAgentChatStatus.RUNNING;

      let { status, currentStep } = researchAgentRecord;

      // Fallback: if run looks active but the external agent already finished,
      // reconcile our DB so the client stops polling.
      if (isActive && researchAgentRecord.externalRunId) {
        const reconciled = await reconcileExternalStatus(
          chatId,
          researchAgentRecord.externalRunId,
        );
        if (reconciled) {
          isActive = false;
          status = reconciled.status;
          currentStep = reconciled.currentStep;
        }
      }

      // Forward new chat messages to research agent (fire-and-forget, runs on each poll)
      if (isActive && researchAgentRecord.externalRunId) {
        forwardNewMessagesToResearchAgent(
          chatId,
          researchAgentRecord.externalRunId,
          researchAgentRecord.lastForwardedAt,
        );
      }

      return c.json({
        hasActiveRun: isActive,
        runId: researchAgentRecord.id,
        status,
        currentStep,
        stepsCount,
        createdAt: researchAgentRecord.createdAt?.toISOString(),
        updatedAt: researchAgentRecord.updatedAt?.toISOString(),
      });
    } catch (error) {
      return handleRouteError(c, "bootstrapper-status", error);
    }
  },
);

// GET /project/:projectId/messages - Get all research agent messages for a project
bootstrapperRouter.get(
  "/project/:projectId/messages",
  zValidator("param", projectParams),
  requirePermission(
    EntityType.PROJECT,
    Action.READ,
    (c) => c.req.param("projectId")!,
  ),
  async (c) => {
    try {
      const projectId = c.req.param("projectId")!;

      const chatRecord = await getChatByProjectId(projectId);
      if (!chatRecord) {
        return c.json({ messages: [] });
      }

      const messages = await getResearchAgentMessagesByChatId(chatRecord.id);
      const reconciledMessages =
        await reconcileSavedMilestonesInMessages(messages);

      const enabledMessages = reconciledMessages.filter((m) =>
        isMessageTypeEnabled(m.type as ResearchAgentMessageTypeValue),
      );

      return c.json({
        messages: enabledMessages.map((m) => ({
          id: m.id,
          chatId: m.chatId,
          researchAgentChatId: m.researchAgentChatId,
          type: m.type,
          data: m.data,
          createdAt:
            m.createdAt instanceof Date
              ? m.createdAt.toISOString()
              : m.createdAt,
        })),
      });
    } catch (error) {
      return handleRouteError(c, "bootstrapper-messages", error);
    }
  },
);

// POST /project/:projectId/messages/:messageId/save-fields - Save fields to project
bootstrapperRouter.post(
  "/project/:projectId/messages/:messageId/save-fields",
  zValidator("param", projectMessageParams),
  zValidator("json", saveToProjectSchema),
  requirePermission(
    EntityType.PROJECT,
    Action.UPDATE,
    (c) => c.req.param("projectId")!,
  ),
  async (c) => {
    try {
      if (!isFieldsPackageEnabled()) {
        return c.json({ error: "Fields feature not enabled" }, 400);
      }
      const projectId = c.req.param("projectId")!;
      const messageId = c.req.param("messageId")!;
      const { itemIndices } = c.req.valid("json");
      const result = await saveFieldsToProject(
        messageId,
        projectId,
        itemIndices,
      );
      return c.json(result);
    } catch (error) {
      if (error instanceof SaveError) {
        return c.json({ error: error.message }, error.statusCode as 400);
      }
      return handleRouteError(c, "bootstrapper-save-fields", error);
    }
  },
);

// POST /project/:projectId/messages/:messageId/save-context - Save context to project
bootstrapperRouter.post(
  "/project/:projectId/messages/:messageId/save-context",
  zValidator("param", projectMessageParams),
  zValidator("json", saveToProjectSchema),
  requirePermission(
    EntityType.PROJECT,
    Action.UPDATE,
    (c) => c.req.param("projectId")!,
  ),
  async (c) => {
    try {
      const projectId = c.req.param("projectId")!;
      const messageId = c.req.param("messageId")!;
      const { itemIndices } = c.req.valid("json");
      const { userId } = c.get("user");
      const result = await saveContextToProject(
        messageId,
        projectId,
        itemIndices,
        userId,
      );
      return c.json(result);
    } catch (error) {
      if (error instanceof SaveError) {
        return c.json({ error: error.message }, error.statusCode as 400);
      }
      return handleRouteError(c, "bootstrapper-save-context", error);
    }
  },
);

// POST /project/:projectId/messages/:messageId/save-documents - Save documents to project
bootstrapperRouter.post(
  "/project/:projectId/messages/:messageId/save-documents",
  zValidator("param", projectMessageParams),
  zValidator("json", saveToProjectSchema),
  requirePermission(
    EntityType.PROJECT,
    Action.UPDATE,
    (c) => c.req.param("projectId")!,
  ),
  async (c) => {
    try {
      if (!isDocumentsPackageEnabled()) {
        return c.json({ error: "Documents feature not enabled" }, 400);
      }
      const projectId = c.req.param("projectId")!;
      const messageId = c.req.param("messageId")!;
      const { itemIndices } = c.req.valid("json");
      const user = c.get("user");
      const result = await saveDocumentsToProject(
        messageId,
        projectId,
        itemIndices,
        user.userId,
      );
      return c.json(result);
    } catch (error) {
      if (error instanceof SaveError) {
        return c.json({ error: error.message }, error.statusCode as 400);
      }
      return handleRouteError(c, "bootstrapper-save-documents", error);
    }
  },
);

// POST /project/:projectId/messages/:messageId/resolve-document-preview - Resolve a document's preview URL
bootstrapperRouter.post(
  "/project/:projectId/messages/:messageId/resolve-document-preview",
  zValidator("param", projectMessageParams),
  zValidator(
    "json",
    z.object({ documentIndex: z.number().int().nonnegative() }),
  ),
  requirePermission(
    EntityType.PROJECT,
    Action.READ,
    (c) => c.req.param("projectId")!,
  ),
  async (c) => {
    try {
      const projectId = c.req.param("projectId")!;
      const messageId = c.req.param("messageId")!;
      const { documentIndex } = c.req.valid("json");

      const message = await getResearchAgentMessageByIdAndProjectId(
        messageId,
        projectId,
      );
      if (!message) {
        throw new SaveError("Message not found", 404);
      }
      if (message.type !== ResearchAgentMessageType.DOCUMENTS) {
        throw new SaveError("Message is not a documents message", 400);
      }

      const { documents } = message.data as DocumentsMessageData;
      if (documentIndex >= documents.length) {
        throw new SaveError("Document index out of bounds", 400);
      }

      const doc = documents[documentIndex];
      if (doc.blobUrl) {
        return c.json({ blobUrl: doc.blobUrl });
      }

      const { userId } = c.get("user");
      const result = await resolveDocumentPreviewUrl(
        messageId,
        documentIndex,
        documents,
        projectId,
        userId,
      );
      return c.json({ blobUrl: result.blobUrl });
    } catch (error) {
      if (error instanceof SaveError) {
        return c.json({ error: error.message }, error.statusCode as 400);
      }
      return handleRouteError(
        c,
        "bootstrapper-resolve-document-preview",
        error,
      );
    }
  },
);

// POST /project/:projectId/messages/:messageId/save-milestones - Save milestones to project
bootstrapperRouter.post(
  "/project/:projectId/messages/:messageId/save-milestones",
  zValidator("param", projectMessageParams),
  zValidator("json", saveMilestonesToProjectSchema),
  requirePermission(
    EntityType.PROJECT,
    Action.UPDATE,
    (c) => c.req.param("projectId")!,
  ),
  async (c) => {
    try {
      if (!isTasksPackageEnabled()) {
        return c.json({ error: "Tasks feature not enabled" }, 400);
      }
      const projectId = c.req.param("projectId")!;
      const messageId = c.req.param("messageId")!;
      const { selections } = c.req.valid("json");
      const { userId } = c.get("user");
      const result = await saveMilestonesToProject(
        messageId,
        projectId,
        selections,
        userId,
      );
      return c.json(result);
    } catch (error) {
      if (error instanceof SaveError) {
        return c.json({ error: error.message }, error.statusCode as 400);
      }
      return handleRouteError(c, "bootstrapper-save-milestones", error);
    }
  },
);

// POST /project/:projectId/messages/:messageId/save-timeline - Save timeline to project
bootstrapperRouter.post(
  "/project/:projectId/messages/:messageId/save-timeline",
  zValidator("param", projectMessageParams),
  zValidator("json", saveToProjectSchema),
  requirePermission(
    EntityType.PROJECT,
    Action.UPDATE,
    (c) => c.req.param("projectId")!,
  ),
  async (c) => {
    try {
      const projectId = c.req.param("projectId")!;
      const messageId = c.req.param("messageId")!;
      const { itemIndices } = c.req.valid("json");
      const { userId } = c.get("user");
      const result = await saveTimelineToProject(
        messageId,
        projectId,
        itemIndices,
        userId,
      );
      return c.json(result);
    } catch (error) {
      if (error instanceof SaveError) {
        return c.json({ error: error.message }, error.statusCode as 400);
      }
      return handleRouteError(c, "bootstrapper-save-timeline", error);
    }
  },
);

export default bootstrapperRouter;
