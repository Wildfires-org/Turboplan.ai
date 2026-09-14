/**
 * Service for generating images using OpenRouter's Gemini 2.5 Flash Image model
 */

import {
  assertCreditsAvailable,
  type BillingContext,
  consumeImageGenerationCredits,
  resolveBillingOrgForProject,
} from "@wildfires-org/turboplan-billing/server";
import { CATALOG } from "@wildfires-org/turboplan-billing/types";
import {
  createGeneratedImage,
  updateProjectCoverImage,
} from "@wildfires-org/turboplan-db/queries";
import { getCommonEnv, getOpenRouterEnv } from "@wildfires-org/turboplan-env";
import { uploadFile } from "@wildfires-org/turboplan-upload/server";

import { getImageModel } from "../server/models";

// Default constants for image generation
const DEFAULT_IMAGE_STYLE = "Calm, Happy";
const DEFAULT_IMAGE_RATIO = "Landscape";

export interface ImageGenerationOptions {
  title: string;
  style?: string;
  ratio?: string;
  entityId: string;
  entityType: "project" | "office" | "organization";
  rawPrompt?: string;
  /**
   * Billing target. When set, the credit gate runs BEFORE generation (hard
   * stop applies) and a flat catalog cost is consumed on success. Callers
   * without an org context may pass null — the call is then unmetered.
   */
  billing?: BillingContext | null;
}

export interface ImageGenerationResult {
  imageUrl: string;
  prompt: string;
}

export interface AutoGenerationResult {
  success: boolean;
  imageUrl?: string;
  error?: string;
}

/**
 * Generate an image using OpenRouter's model
 */
export async function generateImage(
  options: ImageGenerationOptions,
  modelSlot: "image-primary" | "image-lite" = "image-primary",
): Promise<ImageGenerationResult> {
  // Gate before spending: image runs have a flat catalog cost, and a
  // hard-stopped org must not generate. Reserve that known cost so the run
  // can't land the org meaningfully past its hard stop in one shot.
  // CreditsExhaustedError propagates to the caller (the auto-cover wrappers
  // fail silently by design).
  if (options.billing) {
    const flatCosts = CATALOG.billing.flat_credit_costs;
    const cost =
      modelSlot === "image-primary"
        ? flatCosts.image_generation_primary
        : flatCosts.image_generation_lite;
    await assertCreditsAvailable(options.billing.organizationId, cost);
  }

  const aiEnv = getOpenRouterEnv();
  const commonEnv = getCommonEnv();
  const model = await getImageModel(modelSlot);
  const {
    title,
    style = DEFAULT_IMAGE_STYLE,
    ratio = DEFAULT_IMAGE_RATIO,
    entityId,
    entityType,
    rawPrompt,
  } = options;

  const prompt =
    rawPrompt ??
    `Generate a landscape image that fills all the available image area based on the following criteria:

Location: ${title},

Style: ${style},

Ratio: ${ratio},

IMPORTANT:
- No people or humans in the image
- Focus on natural landscapes, scenery, and environment only
- The image should be natural and realistic, without artistic filters or effects`;

  try {
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${aiEnv.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": commonEnv.TURBOPLAN_URL,
          "X-Title": "TurboPlan",
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
          modalities: ["image", "text"],
          stream: false,
        }),
      },
    );

    if (!response.ok) {
      // Parse common error types for better user feedback
      if (response.status === 429) {
        throw new Error(
          "Rate limit exceeded. Please try again in a few moments.",
        );
      }

      if (response.status === 402) {
        throw new Error(
          "OpenRouter quota exceeded. Please check your API billing.",
        );
      }

      if (response.status === 401 || response.status === 403) {
        throw new Error("Authentication failed. Invalid API key.");
      }

      if (response.status === 400) {
        throw new Error(
          "Image generation request was invalid. Please try again with different parameters.",
        );
      }

      // Generic error with details
      throw new Error(
        "Image generation service is temporarily unavailable. Please try again later.",
      );
    }

    let data;
    try {
      data = await response.json();
    } catch (_parseError) {
      throw new Error(
        "Image generation service returned an invalid response. Please try again.",
      );
    }

    // Extract image URL from response
    // According to OpenRouter docs, images are in message.images array
    const message = data.choices?.[0]?.message;

    if (!message) {
      throw new Error(
        "The AI service did not return a valid response. Please try again.",
      );
    }

    // Check for images array
    if (
      !message.images ||
      !Array.isArray(message.images) ||
      message.images.length === 0
    ) {
      throw new Error(
        "Image generation failed. The AI was unable to create an image. Please try again.",
      );
    }

    // Extract the generated image
    const generatedImage = message.images[0];
    const imageUrl = generatedImage?.image_url?.url;

    if (!imageUrl) {
      throw new Error(
        "Image generation failed due to an unexpected format. Please try again.",
      );
    }

    let imageBuffer: ArrayBuffer;

    if (imageUrl.startsWith("data:image")) {
      // It's a base64 data URL, need to extract and decode
      const base64Data = imageUrl.split(",")[1];
      if (!base64Data) {
        throw new Error(
          "Failed to process the generated image. Please try again.",
        );
      }

      // Convert base64 to buffer (Node.js compatible)
      const buffer = Buffer.from(base64Data, "base64");
      imageBuffer = buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength,
      );
    } else {
      // It's a regular URL, fetch it
      const blobResponse = await fetch(imageUrl);
      if (!blobResponse.ok) {
        throw new Error(
          "Failed to save the generated image. Please try again.",
        );
      }
      imageBuffer = await blobResponse.arrayBuffer();
    }

    const key = `generated-images/${entityType}-${entityId}-${Date.now()}.png`;
    const { url: r2Url } = await uploadFile(key, imageBuffer, "image/png");

    await consumeImageGenerationCredits({
      billing: options.billing,
      modelSlot,
      model,
      metadata: { entityType, entityId, modelSlot },
    });

    return {
      imageUrl: r2Url,
      prompt,
    };
  } catch (error) {
    throw error instanceof Error
      ? error
      : new Error("Failed to generate image");
  }
}

/**
 * Automatically generate and set a cover image for a project.
 * Resolves model, API key, and referer URL internally.
 * Designed to fail silently - will not throw errors.
 */
export async function autoGenerateProjectCoverImage(
  projectId: string,
  projectTitle: string,
  userId: string,
): Promise<AutoGenerationResult> {
  try {
    const organizationId = await resolveBillingOrgForProject(projectId);
    const result = await generateImage(
      {
        title: projectTitle,
        entityId: projectId,
        entityType: "project",
        billing: organizationId ? { organizationId, userId } : null,
      },
      "image-lite",
    );

    // Save to database
    const savedImage = await createGeneratedImage({
      entityId: projectId,
      entityType: "project",
      imageUrl: result.imageUrl,
      prompt: result.prompt,
      createdBy: userId,
    });

    // Set as project cover image (using the image ID)
    await updateProjectCoverImage(projectId, savedImage.id);

    return {
      success: true,
      imageUrl: result.imageUrl,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to generate image",
    };
  }
}

/**
 * Automatically generate and set a 3D diorama cover image for a template project.
 * Resolves model, API key, and referer URL internally.
 * Designed to fail silently.
 */
export async function autoGenerateTemplateCoverImage(
  projectId: string,
  projectTitle: string,
  userId: string,
  description?: string | null,
): Promise<AutoGenerationResult> {
  try {
    const descriptionLine = description
      ? ` This template is about: ${description}.`
      : "";

    const organizationId = await resolveBillingOrgForProject(projectId);
    const result = await generateImage(
      {
        title: projectTitle,
        entityId: projectId,
        entityType: "project",
        billing: organizationId ? { organizationId, userId } : null,
        rawPrompt: `Create image of Hyper-realistic 3D diorama representing "${projectTitle}",${descriptionLine} carved out with an exposed cross-section showing relevant underground/foundational layers and sub-surface details. Above: a detailed scene blending whimsical naturalism and technical accuracy with domain-specific elements, tools, and environment appropriate to the template's subject matter. A modern white "${projectTitle}" label integrated into the environment. Pure white studio background with soft natural lighting. DSLR photograph quality — crisp, vibrant, magical-realism style. 16:9 aspect ratio, widescreen landscape orientation. No people or humans in the image.`,
      },
      "image-lite",
    );

    const savedImage = await createGeneratedImage({
      entityId: projectId,
      entityType: "project",
      imageUrl: result.imageUrl,
      prompt: result.prompt,
      createdBy: userId,
    });

    await updateProjectCoverImage(projectId, savedImage.id);

    return {
      success: true,
      imageUrl: result.imageUrl,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to generate template image",
    };
  }
}
