import { smoothStream, streamText } from "ai";
import type { Session } from "next-auth";

import { getModel } from "@wildfires-org/turboplan-ai/server";
import { getPrompt } from "@wildfires-org/turboplan-ai/services";
import {
  meterAiCall,
  resolveBillingOrgForProject,
  resolveBillingOrgForUser,
} from "@wildfires-org/turboplan-billing/server";
import { getChatById } from "@wildfires-org/turboplan-db/queries";

import { createDocumentHandler } from "@/lib/artifacts/server";
import { stripPlaceholderNotesInTableRows } from "@/lib/placeholders";
import type { AuthUser } from "@/lib/types/auth";

// Facts the document model can't see otherwise: today's date (it only lives in
// the chat system prompt, not this separate generation model) and the logged-in
// user's name. Supplied as authoritative context so the draft fills them in
// rather than leaving [INSERT: ...] placeholders.
const buildKnownFacts = (session: Session): string => {
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

  return facts.join("\n");
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

export const textDocumentHandler = createDocumentHandler<"text">({
  kind: "text",
  onCreateDocument: async ({
    title,
    writer,
    userContext,
    projectContext,
    session,
    projectId,
  }) => {
    let draftContent = "";

    const systemPrompt = await getPrompt("text-document");

    const promptParts = [
      `## Known facts (authoritative — use these exact values; do NOT replace them with placeholders)\n${buildKnownFacts(session)}`,
      `Document title: ${title}`,
    ];

    if (userContext) {
      promptParts.push(
        `## Document request (composed by the chat assistant — NOT direct user speech; only its USER-CONFIRMED section counts as the user's statements)\n${userContext}`,
      );
    }

    if (projectContext) {
      promptParts.push(`## Project Context\n${projectContext}`);
    }

    const userPrompt = promptParts.join("\n\n");

    const result = streamText({
      model: await getModel("primary"),
      system: systemPrompt,
      experimental_transform: smoothStream({ chunking: "word" }),
      prompt: userPrompt,
    });

    for await (const delta of result.fullStream) {
      const { type } = delta;

      if (type === "text-delta") {
        const { text: textDelta } = delta;

        draftContent += textDelta;

        writer.write({
          type: "data-artifact",
          data: { type: "text-delta", content: textDelta },
        });
      }
    }

    await meterDocumentRun({ result, session, projectId });

    return stripPlaceholderNotesInTableRows(draftContent);
  },
  onUpdateDocument: async ({ document, description, writer, session }) => {
    let draftContent = "";

    const systemPrompt = await getPrompt("update-document-text", {
      currentContent: document.content,
    });

    const result = streamText({
      model: await getModel("primary"),
      system: systemPrompt,
      experimental_transform: smoothStream({ chunking: "word" }),
      prompt: description,
      providerOptions: {
        openai: {
          prediction: {
            type: "content",
            content: document.content,
          },
        },
      },
    });

    for await (const delta of result.fullStream) {
      const { type } = delta;

      if (type === "text-delta") {
        const { text: textDelta } = delta;

        draftContent += textDelta;
        writer.write({
          type: "data-artifact",
          data: { type: "text-delta", content: textDelta },
        });
      }
    }

    // The document row has no project column — its chat does.
    const chat = document.chatId
      ? await getChatById({ id: document.chatId })
      : null;
    await meterDocumentRun({ result, session, projectId: chat?.projectId });

    return stripPlaceholderNotesInTableRows(draftContent);
  },
});
