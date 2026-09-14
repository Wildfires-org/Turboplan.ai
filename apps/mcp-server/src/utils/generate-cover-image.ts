import {
  assertCreditsAvailable,
  CreditsExhaustedError,
  consumeImageGenerationCredits,
  resolveOrganizationIdForEntity,
} from "@wildfires-org/turboplan-billing/server";
import {
  createGeneratedImage,
  updateOfficeCoverImage,
  updateOrganizationCoverImage,
  updateProjectCoverImage,
} from "@wildfires-org/turboplan-db/queries";
import { getCommonEnv, getOpenRouterEnv } from "@wildfires-org/turboplan-env";
import { uploadFile } from "@wildfires-org/turboplan-upload/server";

/**
 * Minimal, workerd-safe re-implementation of the OpenRouter image-generation
 * core used to set an entity cover image (project, office, or organization).
 *
 * Canonical service:
 *   packages/core/turboplan-ai/src/services/image-generation-service.ts
 *   (autoGenerateTemplateCoverImage / generateImage)
 *
 * WHY THIS EXISTS: importing `@wildfires-org/turboplan-ai/server` would route
 * this tool's execution through the `ai` SDK + `@openrouter/ai-sdk-provider`,
 * which import `zod/v4` explicitly — the build's zod-v3 alias plugin (see
 * build.mjs) only rewrites bare `zod`, so their v4 usage is unverified against
 * workerd on this tool's hot path. This file replicates only the plain-`fetch`
 * core (no `ai` SDK, no provider) so the tool depends on nothing unproven.
 *
 * Keep in sync with the canonical service if its prompt or response handling
 * changes.
 */

export type CoverImageResult = {
  success: boolean;
  imageUrl?: string;
  error?: string;
};

type EntityType = "project" | "office" | "organization";

// Mirrors autoGenerateTemplateCoverImage's prompt in the canonical service.
const buildTemplatePrompt = (
  projectTitle: string,
  description?: string | null,
): string => {
  const descriptionLine = description
    ? ` This template is about: ${description}.`
    : "";

  return `Create image of Hyper-realistic 3D diorama representing "${projectTitle}",${descriptionLine} carved out with an exposed cross-section showing relevant underground/foundational layers and sub-surface details. Above: a detailed scene blending whimsical naturalism and technical accuracy with domain-specific elements, tools, and environment appropriate to the template's subject matter. A modern white "${projectTitle}" label integrated into the environment. Pure white studio background with soft natural lighting. DSLR photograph quality — crisp, vibrant, magical-realism style. 16:9 aspect ratio, widescreen landscape orientation. No people or humans in the image.`;
};

// Mirrors generateImage's default prompt in the canonical service — the same
// realistic landscape style used when creating a project in the app.
const buildProjectPrompt = (
  projectTitle: string,
  description?: string | null,
): string => {
  const descriptionLine = description
    ? `\n\nAdditional context: ${description},`
    : "";

  return `Generate a landscape image that fills all the available image area based on the following criteria:

Location: ${projectTitle},${descriptionLine}

Style: Calm, Happy,

Ratio: Landscape,

IMPORTANT:
- No people or humans in the image
- Focus on natural landscapes, scenery, and environment only
- The image should be natural and realistic, without artistic filters or effects`;
};

// Same realistic-landscape style as projects, with the office located inside
// its parent organization for context.
const buildOfficePrompt = (
  officeName: string,
  organizationName: string,
  description?: string | null,
): string => {
  const descriptionLine = description
    ? `\n\nAdditional context: ${description},`
    : "";

  return `Generate a landscape image that fills all the available image area based on the following criteria:

Location: ${officeName}, part of ${organizationName},${descriptionLine}

Style: Calm, Happy,

Ratio: Landscape,

IMPORTANT:
- No people or humans in the image
- Focus on natural landscapes, scenery, and environment only
- The image should be natural and realistic, without artistic filters or effects`;
};

// Same realistic-landscape style as projects, keyed on the organization name.
const buildOrganizationPrompt = (
  organizationName: string,
  description?: string | null,
): string => {
  const descriptionLine = description
    ? `\n\nAdditional context: ${description},`
    : "";

  return `Generate a landscape image that fills all the available image area based on the following criteria:

Location: ${organizationName},${descriptionLine}

Style: Calm, Happy,

Ratio: Landscape,

IMPORTANT:
- No people or humans in the image
- Focus on natural landscapes, scenery, and environment only
- The image should be natural and realistic, without artistic filters or effects`;
};

/**
 * Shared core: run the OpenRouter image generation for the given prompt/model,
 * upload the result to R2, persist a generated-image record, and point the
 * entity's cover image at it. Never throws — returns { success, imageUrl?,
 * error? }.
 */
const generateAndSaveCoverImage = async (params: {
  entityType: EntityType;
  entityId: string;
  model: string;
  /** Which flat catalog cost applies (matches the canonical service slots). */
  modelSlot: "image-primary" | "image-lite";
  prompt: string;
  userId: string;
  updateCoverPointer: (imageId: string) => Promise<unknown>;
}): Promise<CoverImageResult> => {
  const {
    entityType,
    entityId,
    model,
    modelSlot,
    prompt,
    userId,
    updateCoverPointer,
  } = params;

  // Credit gate before spending — MCP is not a metering bypass. The explicit
  // message is returned as the tool error (this is a plan limit, not an
  // access probe, so no uniform "Access denied").
  const organizationId = await resolveOrganizationIdForEntity(
    entityType,
    entityId,
  );
  if (organizationId) {
    try {
      await assertCreditsAvailable(organizationId);
    } catch (error) {
      if (error instanceof CreditsExhaustedError) {
        return { success: false, error: error.message };
      }
      throw error;
    }
  }

  try {
    const aiEnv = getOpenRouterEnv();
    const commonEnv = getCommonEnv();

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
          messages: [{ role: "user", content: prompt }],
          modalities: ["image", "text"],
          stream: false,
        }),
      },
    );

    if (!response.ok) {
      return {
        success: false,
        error: `Image generation request failed with HTTP ${response.status}.`,
      };
    }

    let data: {
      choices?: Array<{
        message?: { images?: Array<{ image_url?: { url?: string } }> };
      }>;
    };
    try {
      data = await response.json();
    } catch {
      return {
        success: false,
        error: "Image generation service returned an invalid response.",
      };
    }

    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!imageUrl) {
      return {
        success: false,
        error: "Image generation failed — no image returned.",
      };
    }

    let imageBuffer: ArrayBuffer;
    if (imageUrl.startsWith("data:image")) {
      const base64Data = imageUrl.split(",")[1];
      if (!base64Data) {
        return {
          success: false,
          error: "Failed to process the generated image.",
        };
      }
      const buffer = Buffer.from(base64Data, "base64");
      imageBuffer = buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength,
      );
    } else {
      const blobResponse = await fetch(imageUrl);
      if (!blobResponse.ok) {
        return {
          success: false,
          error: "Failed to download the generated image.",
        };
      }
      imageBuffer = await blobResponse.arrayBuffer();
    }

    const key = `generated-images/${entityType}-${entityId}-${Date.now()}.png`;
    const { url: r2Url } = await uploadFile(key, imageBuffer, "image/png");

    const savedImage = await createGeneratedImage({
      entityId,
      entityType,
      imageUrl: r2Url,
      prompt,
      createdBy: userId,
    });

    await updateCoverPointer(savedImage.id);

    await consumeImageGenerationCredits({
      billing: organizationId ? { organizationId, userId } : null,
      modelSlot,
      model,
      metadata: { entityType, entityId, modelSlot, via: "mcp" },
    });

    return { success: true, imageUrl: r2Url };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to generate image",
    };
  }
};

/**
 * Generate and set a cover image for a project. Regular projects get the
 * realistic landscape style used by in-app project creation; template
 * projects get the 3D-diorama style used by the template cataloger.
 * Never throws — returns { success, imageUrl?, error? }.
 */
export const generateProjectCoverImage = async (
  projectId: string,
  projectTitle: string,
  userId: string,
  isTemplate: boolean,
  description?: string | null,
): Promise<CoverImageResult> => {
  const aiEnv = getOpenRouterEnv();
  // Model slots match the canonical service: templates use "image-lite"
  // (autoGenerateTemplateCoverImage), projects use "image-primary"
  // (the in-app image-generation route).
  const model = isTemplate
    ? aiEnv.OPENROUTER_MODEL_IMAGE_LITE
    : aiEnv.OPENROUTER_MODEL_IMAGE_PRIMARY;
  const prompt = isTemplate
    ? buildTemplatePrompt(projectTitle, description)
    : buildProjectPrompt(projectTitle, description);

  return generateAndSaveCoverImage({
    entityType: "project",
    entityId: projectId,
    model,
    modelSlot: isTemplate ? "image-lite" : "image-primary",
    prompt,
    userId,
    updateCoverPointer: (imageId) =>
      updateProjectCoverImage(projectId, imageId),
  });
};

/**
 * Generate and set a cover image for an office. Uses the realistic landscape
 * style (image-primary model), locating the office within its parent
 * organization for context. Never throws.
 */
export const generateOfficeCoverImage = async (
  officeId: string,
  officeName: string,
  organizationName: string,
  userId: string,
  description?: string | null,
): Promise<CoverImageResult> => {
  const aiEnv = getOpenRouterEnv();

  return generateAndSaveCoverImage({
    entityType: "office",
    entityId: officeId,
    model: aiEnv.OPENROUTER_MODEL_IMAGE_PRIMARY,
    modelSlot: "image-primary",
    prompt: buildOfficePrompt(officeName, organizationName, description),
    userId,
    updateCoverPointer: (imageId) => updateOfficeCoverImage(officeId, imageId),
  });
};

/**
 * Generate and set a cover image for an organization. Uses the realistic
 * landscape style (image-primary model). Never throws.
 */
export const generateOrganizationCoverImage = async (
  organizationId: string,
  organizationName: string,
  userId: string,
  description?: string | null,
): Promise<CoverImageResult> => {
  const aiEnv = getOpenRouterEnv();

  return generateAndSaveCoverImage({
    entityType: "organization",
    entityId: organizationId,
    model: aiEnv.OPENROUTER_MODEL_IMAGE_PRIMARY,
    modelSlot: "image-primary",
    prompt: buildOrganizationPrompt(organizationName, description),
    userId,
    updateCoverPointer: (imageId) =>
      updateOrganizationCoverImage(organizationId, imageId),
  });
};
