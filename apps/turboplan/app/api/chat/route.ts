import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  smoothStream,
  stepCountIs,
  streamText,
  type Tool,
  type UIMessage,
  type UIMessageStreamWriter,
} from "ai";
import { Session } from "next-auth";

import { ChatMode, systemPrompt } from "@wildfires-org/turboplan-ai";
import { getModel } from "@wildfires-org/turboplan-ai/server";
import {
  assertCreditsAvailable,
  type BillingContext,
  CreditsExhaustedError,
  meterAiCall,
  resolveBillingOrgForProject,
  resolveBillingOrgForUser,
} from "@wildfires-org/turboplan-billing/server";
import { extractOpenRouterCost } from "@wildfires-org/turboplan-billing/types";
import { isUniqueViolation } from "@wildfires-org/turboplan-db/db-client";
import {
  deleteChatById,
  getChatById,
  getChatsByProjectId,
  saveChat,
  saveMessages,
} from "@wildfires-org/turboplan-db/queries";
import {
  isResearchAgentPackageEnabled,
  isTasksPackageEnabled,
} from "@wildfires-org/turboplan-feature-flags";
import { EntityType, MemberRole } from "@wildfires-org/turboplan-rbac";
import { getRBACService } from "@wildfires-org/turboplan-rbac/server";

import { auth } from "@/app/(auth)/auth";
import { triggerResearchAgent } from "@/app/self-service/helpers";
import { buildSystemPromptArgs } from "@/lib/ai/build-system-prompt-args";
import { generateTitleFromUserMessage } from "@/lib/ai/generate-title";
import { createDocument } from "@/lib/ai/tools/create-document";
import { generateQuickResponses } from "@/lib/ai/tools/generate-quick-responses";
import { getContents } from "@/lib/ai/tools/get-contents";
import { readProjectDocuments } from "@/lib/ai/tools/read-project-documents";
import { requestSuggestions } from "@/lib/ai/tools/request-suggestions";
import { researchNotes } from "@/lib/ai/tools/research-notes";
import { updateDocument } from "@/lib/ai/tools/update-document";
import { updateProjectContext } from "@/lib/ai/tools/update-project-context";
import { updateProjectFields } from "@/lib/ai/tools/update-project-fields";
import { webSearch } from "@/lib/ai/tools/web-search";
import { ErrorResponses } from "@/lib/api/utils";
import { captureServerEvent } from "@/lib/server-analytics";
import { generateUUID, getMostRecentUserMessage } from "@/lib/utils";

// https://vercel.com/docs/functions/configuring-functions/duration
// this sets max duration for the chat route in seconds, it only works for Vercel PRO - see the link for more details
export const maxDuration = 300;

// v4-era attachments arrive on the legacy `experimental_attachments` field,
// which is not part of the v6 UIMessage type.
type LegacyAttachment = {
  url: string;
  name?: string;
  contentType?: string;
};

type MessageWithAttachments = UIMessage & {
  experimental_attachments?: LegacyAttachment[];
};

const GENERIC_STREAM_ERROR_MESSAGE = "Oops, an error occurred!";

const STREAM_ERROR_PATTERNS: Array<{ match: RegExp; message: string }> = [
  {
    match: /requires more credits|can only afford|insufficient[_ ]?credits/i,
    message:
      "You've run out of model credits for this request. Try a shorter prompt.",
  },
  {
    match: /rate[- ]?limit|too many requests/i,
    message:
      "The model is rate-limiting requests right now. Please wait a moment and try again.",
  },
  {
    match: /context[_ ]?length|maximum context length|too many tokens/i,
    message:
      "This conversation is too long for the selected model. Start a new chat to continue.",
  },
  {
    match: /invalid api key|unauthorized|authentication/i,
    message:
      "The model provider rejected our credentials. Please contact support.",
  },
];

const mapStreamErrorToUserMessage = (error: unknown): string => {
  if (!(error instanceof Error)) {
    return GENERIC_STREAM_ERROR_MESSAGE;
  }

  const matched = STREAM_ERROR_PATTERNS.find(({ match }) =>
    match.test(error.message),
  );

  return matched?.message ?? GENERIC_STREAM_ERROR_MESSAGE;
};

/**
 * Creates tool implementations for the active tools.
 *
 * Each tool fetches its own description via getPrompt() internally,
 * so descriptions are manageable from the admin prompt manager UI.
 */
const createTools = async ({
  session,
  writer,
  projectId,
  chatId,
  userMessage,
  activeTools,
  mode,
  projectContext,
  proactiveFieldCreation,
  billing,
}: {
  session: Session;
  writer: UIMessageStreamWriter;
  projectId?: string;
  chatId?: string;
  userMessage?: UIMessage;
  activeTools: string[];
  billing?: BillingContext | null;
  mode?: ChatMode;
  projectContext?: string;
  proactiveFieldCreation?: boolean;
}) => {
  // Always-on tools
  const [
    quickResponsesTool,
    webSearchTool,
    getContentsTool,
    researchNotesTool,
  ] = await Promise.all([
    generateQuickResponses({ mode, billing }),
    webSearch(),
    getContents(),
    researchNotes(),
  ]);

  const tools: Record<string, Tool> = {
    generateQuickResponses: quickResponsesTool,
    webSearch: webSearchTool,
    getContents: getContentsTool,
    researchNotes: researchNotesTool,
  };

  // Conditional document tools
  if (activeTools.includes("createDocument")) {
    const [createDocumentTool, updateDocumentTool, requestSuggestionsTool] =
      await Promise.all([
        createDocument({
          session,
          writer,
          projectId,
          chatId,
          userMessage,
          projectContext,
        }),
        updateDocument({ session, writer }),
        requestSuggestions({ session, writer, billing }),
      ]);

    tools.createDocument = createDocumentTool;
    tools.updateDocument = updateDocumentTool;
    tools.requestSuggestions = requestSuggestionsTool;
  }

  const userId = session.user?.id;

  // Conditional project-documents reader (needs projectId + userId to scope +
  // secure it — the tool re-checks READ permission at execution time)
  if (activeTools.includes("readProjectDocuments") && projectId && userId) {
    tools.readProjectDocuments = await readProjectDocuments({
      projectId,
      userId,
    });
  }

  // Conditional project write tools — gated on the user having UPDATE permission
  // (activeTools already reflects that) and require projectId + userId.
  if (activeTools.includes("updateProjectContext") && projectId && userId) {
    tools.updateProjectContext = await updateProjectContext({
      projectId,
      userId,
    });
  }
  if (activeTools.includes("updateProjectFields") && projectId && userId) {
    tools.updateProjectFields = await updateProjectFields({
      projectId,
      userId,
      proactiveFieldCreation,
    });
  }

  return tools;
};

export async function POST(request: Request) {
  try {
    const {
      id,
      messages,
      projectId,
    }: {
      id: string;
      messages: Array<UIMessage>;
      projectId?: string;
    } = await request.json();

    const session = await auth();

    if (!session || !session.user || !session.user.id) {
      return ErrorResponses.unauthorized();
    }

    const userMessage = getMostRecentUserMessage(messages);

    if (!userMessage) {
      return ErrorResponses.badRequest("No user message found");
    }

    if (!userMessage.parts || userMessage.parts.length === 0) {
      return ErrorResponses.badRequest("Invalid message format");
    }

    const requestStartedAt = Date.now();

    const chat = await getChatById({ id });

    // Resolve the effective projectId (from existing chat or request body). The
    // RBAC check below runs against this value, so all downstream prompt context
    // and tools MUST be bound to it — never the raw body projectId, which for an
    // existing chat could point at a different project the caller was not
    // authorized against. For brand-new chats there is no chat row yet, so this
    // falls back to the body projectId (which IS what RBAC validates).
    const effectiveProjectId = chat?.projectId ?? projectId;

    // Kick off the (expensive) prompt-context build now that we know the
    // authorized projectId — it is independent of the RBAC/save work below, so
    // we overlap its latency with theirs. The result is only consumed on the
    // authorized happy path; early-return paths leave it to settle harmlessly
    // (the .catch prevents an unhandled rejection).
    const promptArgsPromise = buildSystemPromptArgs({
      projectId: effectiveProjectId,
      chatId: id,
      userId: session.user.id,
    });
    promptArgsPromise.catch(() => {});

    // RBAC check: only owners and editors can use project chat
    let hasProjectAccess = false;

    if (effectiveProjectId) {
      const rbacService = getRBACService();
      const role = await rbacService.getEffectiveRole(
        session.user.id,
        effectiveProjectId,
        EntityType.PROJECT,
      );
      if (role !== MemberRole.OWNER && role !== MemberRole.EDITOR) {
        return ErrorResponses.unauthorized();
      }
      hasProjectAccess = true;
    }

    // Credit gate BEFORE any model call (the title generation below is one).
    // Project chats bill the project's org; personal chats bill the user's
    // personal org. Hard-stopped orgs get 402 CREDITS_EXHAUSTED, which the
    // client maps to the upgrade modal.
    const billingOrgId = effectiveProjectId
      ? await resolveBillingOrgForProject(effectiveProjectId)
      : await resolveBillingOrgForUser(session.user.id);
    if (billingOrgId) {
      try {
        await assertCreditsAvailable(billingOrgId);
      } catch (error) {
        if (error instanceof CreditsExhaustedError) {
          return Response.json(
            { error: error.message, code: "CREDITS_EXHAUSTED" },
            { status: 402 },
          );
        }
        throw error;
      }
    }

    // Captured after RBAC and the credit gate so denied or 402-rejected
    // requests don't inflate the metric — only messages that actually
    // proceed to the model count as sent.
    captureServerEvent(session.user.id, "chat_message_sent", {
      chat_id: id,
      project_id: effectiveProjectId,
    });

    // When the user sends the first message of a project's initial chat, kick off
    // the research agent here (not at project creation) so the run's initial prompt
    // includes this message — its description is the best context we have at start.
    let bootstrapProjectId: string | null = null;
    if (!chat) {
      const title = await generateTitleFromUserMessage({
        message: userMessage,
        billing: billingOrgId
          ? { organizationId: billingOrgId, userId: session.user.id }
          : null,
      });

      // Determine if this is the initial chat for the project
      let isInitial = false;
      if (projectId) {
        const existingChats = await getChatsByProjectId({
          projectId,
          limit: 1,
          offset: 0,
        });
        isInitial = existingChats.length === 0;
      }
      if (isInitial && projectId) {
        bootstrapProjectId = projectId;
      }

      try {
        await saveChat({
          id,
          userId: session.user.id,
          title,
          projectId,
          isInitial,
        });
      } catch (error: unknown) {
        // If another request already created this chat (e.g. React StrictMode
        // double-mounting in dev causes two near-simultaneous requests),
        // PostgreSQL rejects the duplicate insert with error 23505 (unique_violation).
        // Throw "Already processing" so the outer catch returns 409 and the
        // frontend silently ignores it — preventing duplicate messages and
        // parallel AI streams that cause the UI to blink.
        if (isUniqueViolation(error)) {
          throw new Error("Already processing");
        }
        throw error;
      }
      // User created this chat, so they have access
      hasProjectAccess = true;
    } else if (chat.userId === session.user.id) {
      // Chat creator always has access
      hasProjectAccess = true;
    } else {
      // User didn't create this chat — check project-level access (owner/editor)
      if (!chat.projectId) {
        return ErrorResponses.unauthorized();
      }
      const rbacService = getRBACService();
      const role = await rbacService.getEffectiveRole(
        session.user.id,
        chat.projectId,
        EntityType.PROJECT,
      );
      if (role !== MemberRole.OWNER && role !== MemberRole.EDITOR) {
        return ErrorResponses.unauthorized();
      }
      hasProjectAccess = true;
    }

    await saveMessages({
      messages: [
        {
          chatId: id,
          id: userMessage.id,
          role: "user",
          parts: userMessage.parts,
          attachments:
            (userMessage as MessageWithAttachments).experimental_attachments ??
            [],
          createdAt: new Date(),
        },
      ],
    });

    // Fire-and-forget: start the research agent now that the first message is
    // persisted, so /start builds the prompt with this conversation included.
    if (bootstrapProjectId && isResearchAgentPackageEnabled()) {
      void triggerResearchAgent(session.user.id, bootstrapProjectId);
    }

    // Bind all downstream tools/context to the RBAC-validated project, not the
    // raw body projectId (see effectiveProjectId above).
    const chatProjectId = effectiveProjectId;

    // Await the build kicked off at the top of the handler — by now it has had
    // the auth/RBAC/save latency to run in parallel, so this usually resolves
    // immediately.
    const promptArgs = await promptArgsPromise;

    // Strip tasks context when user lacks project access
    if (!hasProjectAccess) {
      promptArgs.projectTasksContext = undefined;
    }

    const projectContext =
      [
        promptArgs.projectContextData,
        promptArgs.projectFieldsContext,
        promptArgs.savedResearchContext,
        promptArgs.unsavedResearchContext,
        promptArgs.projectTasksContext,
        promptArgs.projectDocumentsContext,
      ]
        .filter(Boolean)
        .join("\n\n") || undefined;

    // Only images and PDFs can be sent to the model — Anthropic rejects other
    // file types (e.g. docx) with a 400. Unsupported file parts are dropped
    // from `parts` (which convertToModelMessages actually consumes) and
    // replaced with a text note; ZIP files get a geospatial hint instead.
    const isModelReadableType = (contentType?: string) =>
      Boolean(
        contentType?.startsWith("image/") || contentType === "application/pdf",
      );

    // URL segments come from client-supplied file parts and can contain
    // invalid percent-encoding (e.g. "%ZZ"), which makes decodeURIComponent
    // throw — fall back to the raw segment instead of failing the request.
    const safeDecodeURIComponent = (value: string): string => {
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    };

    const aiSupportedMessages = messages.map((message) => {
      const messageAttachments: LegacyAttachment[] =
        (message as MessageWithAttachments).experimental_attachments ?? [];

      const zipTypes = [
        "application/zip",
        "application/x-zip-compressed",
        "application/octet-stream",
      ];

      const supportedAttachments = messageAttachments.filter((att) =>
        isModelReadableType(att.contentType),
      );

      // The model payload is built from `parts` (v6), so unsupported-file
      // detection must run on file parts — experimental_attachments is empty
      // on messages sent via the v6 sendMessage path.
      const fileParts = (message.parts ?? []).filter(
        (part) => part.type === "file",
      );
      const filePartName = (part: (typeof fileParts)[number]) =>
        ("filename" in part ? part.filename : undefined) ||
        safeDecodeURIComponent(part.url.split("/").pop() || "") ||
        "unnamed file";
      const isZipPart = (part: (typeof fileParts)[number]) =>
        zipTypes.includes(part.mediaType || "") ||
        filePartName(part).toLowerCase().endsWith(".zip");

      const zipParts = fileParts.filter(isZipPart);
      const droppedParts = fileParts.filter(
        (part) => !isModelReadableType(part.mediaType) && !isZipPart(part),
      );

      const noteLines: string[] = [];
      if (zipParts.length > 0) {
        const zipFileNames = zipParts.map(filePartName).join(", ");
        noteLines.push(
          `[System: User has uploaded ZIP file(s): ${zipFileNames} - these contain geospatial data ready for map visualization]`,
        );
      }
      if (droppedParts.length > 0) {
        const droppedNames = droppedParts.map(filePartName).join(", ");
        noteLines.push(
          `[System: User attached document(s) the model cannot read directly: ${droppedNames}]`,
        );
      }

      let updatedParts = message.parts?.filter(
        (part) =>
          part.type !== "file" ||
          part.mediaType?.startsWith("image/") ||
          part.mediaType === "application/pdf",
      );

      if (updatedParts && noteLines.length > 0) {
        const note = noteLines.join("\n");
        // Append the note to the first text part only — mapping over all text
        // parts would duplicate it in the model input.
        const firstTextIndex = updatedParts.findIndex(
          (part) => part.type === "text",
        );
        updatedParts =
          firstTextIndex === -1
            ? [...updatedParts, { type: "text" as const, text: note }]
            : updatedParts.map((part, index) =>
                index === firstTextIndex && part.type === "text"
                  ? { ...part, text: `${part.text}\n\n${note}` }
                  : part,
              );
      }

      return {
        ...message,
        ...(updatedParts ? { parts: updatedParts } : {}),
        experimental_attachments:
          supportedAttachments.length > 0 ? supportedAttachments : undefined,
      };
    });

    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        // Notify user if they lack project access (tasks context will be excluded)
        if (chatProjectId && isTasksPackageEnabled() && !hasProjectAccess) {
          writer.write({
            type: "data-artifact",
            data: {
              type: "error",
              content:
                "You do not have permission to access this project's context.",
            },
          });
        }

        const [tools, model, system, modelMessages] = await Promise.all([
          createTools({
            session,
            writer,
            projectId: chatProjectId,
            chatId: id,
            userMessage,
            activeTools: promptArgs.activeTools,
            mode: promptArgs.mode,
            projectContext,
            proactiveFieldCreation: promptArgs.isBroughtProject,
            billing: billingOrgId
              ? { organizationId: billingOrgId, userId: session.user?.id }
              : null,
          }),
          getModel("primary"),
          systemPrompt(promptArgs),
          convertToModelMessages(aiSupportedMessages),
        ]);

        // Single multi-step stream (matches the v4 flow and upstream Vercel
        // chatbot): the model researches as needed, synthesizes a text answer,
        // and calls generateQuickResponses at the end. The OpenRouter provider
        // uses Chat Completions, so tool results thread back and the model stops
        // on its own instead of looping — no forced toolChoice needed.
        // Per-step cost accumulation: `result.providerMetadata` is the LAST
        // step's metadata only, while multi-step tool runs bill every step —
        // summing here is what makes multi-step chats charge correctly, and
        // it survives a mid-run failure (completed steps stay accumulated).
        let accumulatedCostUsd = 0;
        let accumulatedTokens = 0;
        let meteredChatRun = false;
        const meterChatRun = async () => {
          if (meteredChatRun || !billingOrgId) {
            return;
          }
          meteredChatRun = true;
          if (accumulatedCostUsd <= 0 && accumulatedTokens <= 0) {
            return;
          }
          await meterAiCall({
            billing: {
              organizationId: billingOrgId,
              userId: session.user?.id,
            },
            source: "chat",
            usage: { totalTokens: accumulatedTokens },
            costUsd: accumulatedCostUsd > 0 ? accumulatedCostUsd : undefined,
            model: typeof model === "string" ? model : model.modelId,
            metadata: { chatId: id, projectId: chatProjectId ?? null },
          });
        };

        const result = streamText({
          model,
          system,
          messages: modelMessages,
          tools,
          activeTools: promptArgs.activeTools as Array<keyof typeof tools>,
          stopWhen: stepCountIs(10),
          experimental_transform: smoothStream({ chunking: "word" }),
          onStepFinish: (step) => {
            accumulatedCostUsd +=
              extractOpenRouterCost(step.providerMetadata) ?? 0;
            accumulatedTokens += step.usage?.totalTokens ?? 0;
          },
        });

        // sendFinish:false keeps the assistant message open so we can append
        // the quick-response suggestions below before the stream is finalized.
        writer.merge(
          result.toUIMessageStream({
            sendReasoning: true,
            sendFinish: false,
          }),
        );

        // Guarantee quick-response suggestions after every answer. The model
        // usually calls generateQuickResponses itself; this is a fallback for
        // when it doesn't, so the user always gets suggested replies.
        try {
          const [finalText, steps] = await Promise.all([
            result.text,
            result.steps,
          ]);

          // Meter the accumulated run (awaited: cheap DB write; Vercel cannot
          // reap it before it lands).
          await meterChatRun();

          const alreadyHasQuickResponses = steps.some((step) =>
            step.toolCalls?.some(
              (tc) => tc.toolName === "generateQuickResponses",
            ),
          );

          if (
            finalText.trim().length > 0 &&
            !alreadyHasQuickResponses &&
            promptArgs.activeTools.includes("generateQuickResponses")
          ) {
            const qrToolCallId = generateUUID();
            const qrContext = finalText.slice(0, 800);

            writer.write({
              type: "tool-input-available",
              toolCallId: qrToolCallId,
              toolName: "generateQuickResponses",
              input: { conversationContext: qrContext },
            });

            const qrResult = await (
              tools.generateQuickResponses as unknown as {
                execute: (
                  input: { conversationContext: string },
                  options: { toolCallId: string },
                ) => Promise<unknown>;
              }
            ).execute(
              { conversationContext: qrContext },
              { toolCallId: qrToolCallId },
            );

            writer.write({
              type: "tool-output-available",
              toolCallId: qrToolCallId,
              output: qrResult,
            });
          }
        } catch (error) {
          console.error("[Chat] Quick responses generation failed:", error);
          // A mid-run failure still consumed every COMPLETED step — bill the
          // accumulator so provider spend is never silently free.
          await meterChatRun();
        }

        if (session.user?.id) {
          captureServerEvent(session.user.id, "ai_response_received", {
            chat_id: id,
            project_id: effectiveProjectId,
            model: typeof model === "string" ? model : model.modelId,
            latency_ms: Date.now() - requestStartedAt,
            total_tokens: accumulatedTokens,
          });
        }

        // We suppressed the stream's own finish chunk (sendFinish:false) so we
        // could append the quick responses above; emit it now so the client
        // transitions out of the "streaming" state.
        writer.write({ type: "finish" });
      },
      generateId: generateUUID,
      originalMessages: messages,
      onFinish: async ({ responseMessage }) => {
        if (session.user?.id) {
          try {
            const cleanedParts = responseMessage.parts
              ? responseMessage.parts.filter(
                  (part: { type: string; text?: string }) => {
                    if (part.type === "text") {
                      return part.text && part.text.trim().length > 0;
                    }
                    return true;
                  },
                )
              : [];

            await saveMessages({
              messages: [
                {
                  id: responseMessage.id,
                  chatId: id,
                  role: responseMessage.role,
                  parts: cleanedParts,
                  attachments: [],
                  createdAt: new Date(),
                },
              ],
            });
          } catch (error) {
            console.error("Failed to save chat:", error);
          }
        }
      },
      onError: (error) => {
        console.error("[Chat] Stream error:", error);
        return mapStreamErrorToUserMessage(error);
      },
    });

    return createUIMessageStreamResponse({ stream });
  } catch (error) {
    // Duplicate request for the same chat — return 409 so the frontend
    // silently ignores it (see onError in project-chat.tsx)
    if (error instanceof Error && error.message === "Already processing") {
      return new Response("Already processing", { status: 409 });
    }
    console.error("Error in chat route:", error);
    return ErrorResponses.internalServerError(
      "An error occurred while processing your request!",
    );
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return ErrorResponses.badRequest("Chat ID is required");
  }

  const session = await auth();

  if (!session || !session.user) {
    return ErrorResponses.unauthorized();
  }

  try {
    const chat = await getChatById({ id });

    if (chat.userId !== session.user.id) {
      return ErrorResponses.unauthorized();
    }

    await deleteChatById({ id });

    return new Response("Chat deleted", { status: 200 });
  } catch (_error) {
    return ErrorResponses.internalServerError(
      "An error occurred while processing your request!",
    );
  }
}
