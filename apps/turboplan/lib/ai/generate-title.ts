import type { UIMessage } from "ai";
import { generateText } from "ai";

import { getModel } from "@wildfires-org/turboplan-ai/server";
import {
  type BillingContext,
  meterAiCall,
} from "@wildfires-org/turboplan-billing/server";

/**
 * Server-only chat title generation. Deliberately NOT a server action: the
 * billing target must never cross the client trust boundary (a client-
 * invokable action taking `billing` would let any authenticated user run
 * unmetered model calls or charge arbitrary orgs). Only the chat route —
 * which authenticates, gates and resolves the org itself — calls this.
 */
export const generateTitleFromUserMessage = async ({
  message,
  billing,
}: {
  message: UIMessage;
  billing?: BillingContext | null;
}) => {
  const generation = await generateText({
    model: await getModel("lite"),
    system: `Generate a short title based on the first message a user begins a conversation with. Respond with ONLY the title text, nothing else. No quotes, no colons, no markdown, no explanation, no reasoning. Maximum 80 characters.`,
    prompt: JSON.stringify(message),
  });

  await meterAiCall({
    billing,
    source: "title",
    usage: generation.usage,
    providerMetadata: generation.providerMetadata,
  });

  return generation.text;
};
