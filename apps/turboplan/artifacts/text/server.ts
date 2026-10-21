import {
  type LanguageModelUsage,
  smoothStream,
  streamText,
  type UIMessageStreamWriter,
} from "ai";
import type { Session } from "next-auth";

import { getModel } from "@wildfires-org/turboplan-ai/server";
import { getPrompt } from "@wildfires-org/turboplan-ai/services";
import {
  meterAiCall,
  resolveBillingOrgForProject,
  resolveBillingOrgForUser,
} from "@wildfires-org/turboplan-billing/server";
import { getChatById } from "@wildfires-org/turboplan-db/queries";
import {
  getProjectDocumentProfile,
  getProjectLetterhead,
} from "@wildfires-org/turboplan-workspace/server";
import { documentProfileToFacts } from "@wildfires-org/turboplan-workspace/types";

import {
  type ChatTimingLog,
  createChatTimer,
  getErrorName,
  summarizeUsage,
} from "@/lib/ai/chat-timing";
import { formatReferenceDocuments } from "@/lib/ai/reference-documents";
import { createDocumentHandler } from "@/lib/artifacts/server";
import { stripPlaceholderNotesInTableRows } from "@/lib/placeholders";
import type { AuthUser } from "@/lib/types/auth";
import {
  buildLetterheadSection,
  letterheadContactFact,
} from "./letterhead-prompt";

// Facts the document model can't see otherwise: today's date (it only lives in
// the chat system prompt, not this separate generation model) and the logged-in
// user's name. Supplied as authoritative context so the draft fills them in
// rather than leaving [INSERT: ...] placeholders.
const buildKnownFacts = (session: Session, officeFacts: string[]): string => {
  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const profile = (session?.user as AuthUser | undefined)?.profile;
  const preparerName = [profile?.firstName, profile?.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  const facts = [`Today's date: ${today}.`];
  if (preparerName) {
    facts.push(
      `The logged-in user preparing this document is ${preparerName}.`,
    );
  }

  if (officeFacts.length > 0) {
    facts.push(
      "Office document details (confirmed by the office — use these values wherever the document needs them):",
      ...officeFacts.map((fact) => `- ${fact}`),
    );
  }

  return facts.join("\n");
};

// Confirmed office/org facts (signatory, contacts, file code, …) from the
// office's document details. Never breaks document generation.
const loadOfficeFacts = async (
  projectId: string | null | undefined,
): Promise<string[]> => {
  if (!projectId) {
    return [];
  }
  try {
    return documentProfileToFacts(await getProjectDocumentProfile(projectId));
  } catch (error) {
    console.error("[documents] failed to load document profile:", error);
    return [];
  }
};

/**
 * Meter a finished document-generation run. The gate already ran on the chat
 * request that invoked this tool, so this only records consumption. Awaited
 * after the stream completes; failures never break the artifact.
 */
const meterDocumentRun = async ({
  result,
  session,
  projectId,
}: {
  result: ReturnType<typeof streamText>;
  session: Session;
  projectId: string | null | undefined;
}): Promise<void> => {
  try {
    const userId = session?.user?.id;
    const organizationId = projectId
      ? await resolveBillingOrgForProject(projectId)
      : userId
        ? await resolveBillingOrgForUser(userId)
        : null;
    if (!organizationId) {
      return;
    }

    const [totalUsage, providerMetadata] = await Promise.all([
      result.totalUsage,
      result.providerMetadata,
    ]);
    // Single-step run (no tools), so the final-step providerMetadata IS the
    // whole run's cost.
    await meterAiCall({
      billing: { organizationId, userId },
      source: "document",
      usage: totalUsage,
      providerMetadata,
      metadata: { totalTokens: totalUsage.totalTokens },
    });
  } catch (error) {
    console.error("[billing] document credit consumption failed:", error);
  }
};

/**
 * Streams the draft to the client as artifact deltas and returns the full
 * text. Timing is document-local: elapsedMs counts from document start.
 */
const streamDraft = async ({
  result,
  writer,
  logTiming,
  startedAt,
  onProgress,
}: {
  result: ReturnType<typeof streamText>;
  writer: UIMessageStreamWriter;
  logTiming: ChatTimingLog;
  startedAt: number;
  onProgress?: (content: string) => void;
}): Promise<string> => {
  let draftContent = "";
  let deltaCount = 0;
  let totalUsage: LanguageModelUsage | undefined;
  let finishReason: string | undefined;
  let errorName: string | undefined;

  for await (const delta of result.fullStream) {
    if (delta.type === "finish") {
      totalUsage = delta.totalUsage;
      finishReason = delta.finishReason;
    }

    if (delta.type === "error") {
      errorName = getErrorName(delta.error);
    }

    if (delta.type === "text-delta") {
      if (deltaCount === 0) {
        logTiming("document-first-token", { ttftMs: Date.now() - startedAt });
      }
      deltaCount += 1;
      draftContent += delta.text;

      writer.write({
        type: "data-artifact",
        transient: true,
        data: { type: "text-delta", content: delta.text },
      });
      onProgress?.(draftContent);
    }
  }

  logTiming("document-finished", {
    durationMs: Date.now() - startedAt,
    outputChars: draftContent.length,
    deltaCount,
    finishReason,
    errorName,
    usage: summarizeUsage(totalUsage),
  });

  return draftContent;
};

export const textDocumentHandler = createDocumentHandler<"text">({
  kind: "text",
  onCreateDocument: async ({
    title,
    writer,
    userContext,
    projectContext,
    session,
    projectId,
    chatId,
    loadReferenceDocuments,
    letterhead: chosenLetterhead,
    onDraftProgress,
  }) => {
    const startedAt = Date.now();
    const logTiming = createChatTimer({ chatId, startedAt });

    // Undefined: no letterhead was chosen for this document, so fall back to
    // the project default. Null ("none") stays null — no Application
    // letterhead section, so the generator writes the author's own.
    const [systemPrompt, referenceDocuments, letterhead, officeFacts] =
      await Promise.all([
        getPrompt("text-document"),
        loadReferenceDocuments?.() ?? [],
        chosenLetterhead !== undefined
          ? chosenLetterhead
          : projectId
            ? getProjectLetterhead(projectId).catch(() => null)
            : null,
        loadOfficeFacts(projectId),
      ]);
    // An admin-entered letterhead's address block is a confirmed fact; a
    // reference copy's lines stay quoted data in the letterhead section.
    const contactFact = letterheadContactFact(letterhead);
    if (contactFact) {
      officeFacts.push(contactFact);
    }

    const promptParts = [
      `## Known facts (authoritative — use these exact values; do NOT replace them with placeholders)\n${buildKnownFacts(session, officeFacts)}`,
      `Document title: ${title}`,
    ];

    if (userContext) {
      promptParts.push(
        `## Document request (composed by the chat assistant — NOT direct user speech; only its USER-CONFIRMED section counts as the user's statements)\n${userContext}`,
      );
    }

    if (referenceDocuments.length > 0) {
      promptParts.push(formatReferenceDocuments(referenceDocuments));
    }

    if (projectContext) {
      promptParts.push(`## Project Context\n${projectContext}`);
    }

    if (letterhead) {
      promptParts.push(
        `## Application letterhead\n${buildLetterheadSection(letterhead)}`,
      );
    }

    const userPrompt = promptParts.join("\n\n");

    logTiming("document-start", {
      userContextChars: userContext?.length ?? 0,
      referenceCount: referenceDocuments.length,
      referenceChars: referenceDocuments.reduce(
        (total, { text }) => total + text.length,
        0,
      ),
      projectContextChars: projectContext?.length ?? 0,
      promptChars: userPrompt.length,
      systemChars: systemPrompt.length,
    });

    const result = streamText({
      model: await getModel("primary"),
      system: systemPrompt,
      experimental_transform: smoothStream({ chunking: "word" }),
      prompt: userPrompt,
    });

    // Checkpoints store the raw draft; only the final save is cleaned up.
    const draftContent = await streamDraft({
      result,
      writer,
      logTiming,
      startedAt,
      onProgress: onDraftProgress,
    });

    await meterDocumentRun({ result, session, projectId });

    return stripPlaceholderNotesInTableRows(draftContent);
  },
  onUpdateDocument: async ({ document, description, writer, session }) => {
    const startedAt = Date.now();
    const logTiming = createChatTimer({ chatId: document.chatId, startedAt });

    // The document row has no project column — its chat does.
    const chat = document.chatId
      ? await getChatById({ id: document.chatId })
      : null;
    const officeFacts = await loadOfficeFacts(chat?.projectId);
    const prompt =
      officeFacts.length > 0
        ? `${description}\n\n## Office document details (confirmed — use these values to fill matching [INSERT: …] placeholders)\n${officeFacts.map((fact) => `- ${fact}`).join("\n")}`
        : description;

    const systemPrompt = await getPrompt("update-document-text", {
      currentContent: document.content,
    });

    logTiming("document-start", {
      currentContentChars: document.content?.length ?? 0,
      promptChars: description.length,
      systemChars: systemPrompt.length,
    });

    const result = streamText({
      model: await getModel("primary"),
      system: systemPrompt,
      experimental_transform: smoothStream({ chunking: "word" }),
      prompt,
      providerOptions: {
        openai: {
          prediction: {
            type: "content",
            content: document.content,
          },
        },
      },
    });

    const draftContent = await streamDraft({
      result,
      writer,
      logTiming,
      startedAt,
    });

    await meterDocumentRun({ result, session, projectId: chat?.projectId });

    return stripPlaceholderNotesInTableRows(draftContent);
  },
});
