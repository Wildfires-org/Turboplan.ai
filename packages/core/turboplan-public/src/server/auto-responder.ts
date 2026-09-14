/**
 * Auto-responder service for generating AI acknowledgment replies to user comments.
 *
 * When a user posts a comment on a public project page, this service:
 * 1. Generates a personalized acknowledgment using AI
 * 2. Creates a reply comment from the office owner
 * 3. The reply is private by default, visible only to the commenter
 */

import { generateText } from "ai";

import { getModel } from "@wildfires-org/turboplan-ai/server";
import { getPrompt } from "@wildfires-org/turboplan-ai/services";
import {
  assertCreditsAvailable,
  CreditsExhaustedError,
  meterAiCall,
  resolveBillingOrgForProject,
} from "@wildfires-org/turboplan-billing/server";
import {
  createComment,
  getCommentById,
  getProfileByUserId,
} from "@wildfires-org/turboplan-db/queries";

import { getProjectWithOfficeForAutoResponse } from "../queries";

const SIGNATURE = "– Automated Acknowledgment";
const AI_REQUEST_TIMEOUT_MS = 15000; // 15 seconds

/**
 * Sanitize text for safe inclusion in AI prompts.
 * Removes characters that could be used for prompt injection.
 */
function sanitizeForPrompt(text: string): string {
  return text
    .replace(/[<>{}[\]"'`]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Replace auto-responder specific variables in the prompt.
 * These variables are specific to the comment auto-responder and not part
 * of the general prompt variable system.
 */
function replaceAutoResponderVariables(
  content: string,
  context: {
    responderName: string;
    commenterName: string;
    commentContent: string;
    signature: string;
  },
): string {
  return content
    .replace(/\{\{responderName\}\}/g, sanitizeForPrompt(context.responderName))
    .replace(/\{\{commenterName\}\}/g, sanitizeForPrompt(context.commenterName))
    .replace(
      /\{\{commentContent\}\}/g,
      sanitizeForPrompt(context.commentContent),
    )
    .replace(/\{\{signature\}\}/g, context.signature);
}

/**
 * Generate the AI response text for a comment acknowledgment.
 */
async function generateAutoResponseText(context: {
  responderName: string;
  commenterName: string;
  commentContent: string;
  signature: string;
  billing?: { organizationId: string } | null;
}): Promise<string> {
  const model = await getModel("primary");

  // Get the base prompt template
  const promptTemplate = await getPrompt("project-comment-auto-responder");

  // Replace auto-responder specific variables (sanitization happens inside)
  const prompt = replaceAutoResponderVariables(promptTemplate, {
    responderName: context.responderName,
    commenterName: context.commenterName,
    commentContent: context.commentContent.slice(0, 500), // Truncate for safety
    signature: context.signature,
  });

  // Add timeout to prevent hanging requests
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error("AI request timeout")),
      AI_REQUEST_TIMEOUT_MS,
    ),
  );

  const generatePromise = generateText({
    model,
    prompt,
    temperature: 0.7,
    // Cancel on timeout — a race-losing call must not run to completion at
    // our cost with no metering.
    abortSignal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
  });

  // Meter on the generate promise itself so whatever completes gets billed
  // even when the response path already timed out.
  void generatePromise
    .then((generation) =>
      meterAiCall({
        billing: context.billing,
        source: "auto_responder",
        usage: generation.usage,
        providerMetadata: generation.providerMetadata,
      }),
    )
    .catch(() => {});

  const result = await Promise.race([generatePromise, timeoutPromise]);

  return result.text.trim();
}

/**
 * Generate and create an auto-response comment for a newly created comment.
 *
 * This function:
 * 1. Gets project/office info to derive responder name
 * 2. Gets commenter profile for personalization
 * 3. Generates AI response text
 * 4. Creates reply comment (private, targeted at commenter)
 */
export async function generateAutoResponseForComment(params: {
  commentId: string;
  projectId: string;
  commenterId: string;
}): Promise<void> {
  try {
    // 1. Get project with office info (name, ownerId)
    const projectInfo = await getProjectWithOfficeForAutoResponse(
      params.projectId,
    );
    if (!projectInfo) {
      console.error("[auto-responder] Project not found:", params.projectId);
      return;
    }

    // 2. Derive responder name from office
    const responderName = `${projectInfo.officeName} Responder`;

    // 3. Get commenter profile (firstName for personalization)
    const commenter = await getProfileByUserId(params.commenterId);
    const commenterName = commenter?.firstName || "Commenter";

    // 4. Get original comment content
    const comment = await getCommentById(params.commentId);
    if (!comment) {
      console.error("[auto-responder] Comment not found:", params.commentId);
      return;
    }

    // Credit gate: this runs off the public-project comment flow (login is
    // required to post the triggering comment, but the project itself is
    // publicly reachable and needs no org membership) with the PRIMARY
    // model — without the gate, a hard-stopped org's cap would be bypassable
    // by anyone who can create an account. Exhausted → skip the
    // auto-response silently (it is a courtesy acknowledgment, not core
    // function).
    const billingOrgId = await resolveBillingOrgForProject(params.projectId);
    if (billingOrgId) {
      try {
        await assertCreditsAvailable(billingOrgId);
      } catch (error) {
        if (error instanceof CreditsExhaustedError) {
          console.log(
            "[auto-responder] credits exhausted, skipping auto-response for project:",
            params.projectId,
          );
          return;
        }
        throw error;
      }
    }

    // 5. Generate AI response
    const generatedResponse = await generateAutoResponseText({
      responderName,
      commenterName,
      commentContent: comment.content,
      signature: SIGNATURE,
      billing: billingOrgId ? { organizationId: billingOrgId } : null,
    });

    // 6. Create reply comment
    await createComment({
      projectId: params.projectId,
      userId: projectInfo.officeOwnerId, // Office owner posts the response
      parentCommentId: params.commentId, // Reply to original
      content: generatedResponse,
      isPublic: false, // Private by default
      isAutoResponse: true, // Mark as auto-response
      targetUserId: params.commenterId, // Visible to commenter
      autoResponderName: responderName, // Display name for the responder
    });

    console.log(
      "[auto-responder] Auto-response created for comment:",
      params.commentId,
    );
  } catch (error) {
    console.error("[auto-responder] Failed to generate auto-response:", error);
    // Don't rethrow - this is fire-and-forget
  }
}
