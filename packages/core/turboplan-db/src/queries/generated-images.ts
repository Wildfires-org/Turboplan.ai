import { and, eq, inArray } from "drizzle-orm";

import { db } from "../db-client";
import { generatedImages, office, organization, project } from "../schemas";

/**
 * Create a new generated image record
 */
export async function createGeneratedImage(data: {
  entityId: string;
  entityType: "project" | "office" | "organization";
  imageUrl: string;
  prompt: string;
  createdBy: string;
}) {
  const [image] = await db
    .insert(generatedImages)
    .values({
      entityId: data.entityId,
      entityType: data.entityType,
      imageUrl: data.imageUrl,
      prompt: data.prompt,
      createdBy: data.createdBy,
    })
    .returning();

  return image;
}

/**
 * Get all generated images for a specific entity
 */
export async function getGeneratedImagesByEntity(
  entityId: string,
  entityType: "project" | "office" | "organization",
) {
  return await db
    .select()
    .from(generatedImages)
    .where(
      and(
        eq(generatedImages.entityId, entityId),
        eq(generatedImages.entityType, entityType),
      ),
    )
    .orderBy(generatedImages.createdAt);
}

/**
 * Get a single generated image by ID
 */
export async function getGeneratedImageById(id: string) {
  const [image] = await db
    .select()
    .from(generatedImages)
    .where(eq(generatedImages.id, id))
    .limit(1);

  return image;
}

/**
 * Get multiple generated images by their IDs in a single query.
 * Returns a Map of imageId → imageUrl for easy lookup.
 */
export async function getGeneratedImageUrlsByIds(
  ids: string[],
): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();

  const images = await db
    .select({ id: generatedImages.id, imageUrl: generatedImages.imageUrl })
    .from(generatedImages)
    .where(inArray(generatedImages.id, ids));

  return new Map(images.map((img) => [img.id, img.imageUrl]));
}

/**
 * Delete a generated image record
 * Note: Caller is responsible for deleting the blob file
 */
export async function deleteGeneratedImage(id: string) {
  const [deletedImage] = await db
    .delete(generatedImages)
    .where(eq(generatedImages.id, id))
    .returning();

  return deletedImage;
}

/**
 * Update a project's selected cover image by ID
 */
export async function updateProjectCoverImage(
  projectId: string,
  imageId: string | null,
) {
  const [updatedProject] = await db
    .update(project)
    .set({ coverImageId: imageId })
    .where(eq(project.id, projectId))
    .returning();

  return updatedProject;
}

/**
 * Update an office's selected cover image by ID
 */
export async function updateOfficeCoverImage(
  officeId: string,
  imageId: string | null,
) {
  const [updatedOffice] = await db
    .update(office)
    .set({ coverImageId: imageId })
    .where(eq(office.id, officeId))
    .returning();

  return updatedOffice;
}

/**
 * Update an organization's selected cover image by ID
 */
export async function updateOrganizationCoverImage(
  organizationId: string,
  imageId: string | null,
) {
  const [updatedOrganization] = await db
    .update(organization)
    .set({ coverImageId: imageId })
    .where(eq(organization.id, organizationId))
    .returning();

  return updatedOrganization;
}

/**
 * Delete all generated images for a specific entity.
 * Returns deleted images so caller can cleanup storage files.
 */
export async function deleteGeneratedImagesByEntity(
  entityId: string,
  entityType: "project" | "office" | "organization",
) {
  const deletedImages = await db
    .delete(generatedImages)
    .where(
      and(
        eq(generatedImages.entityId, entityId),
        eq(generatedImages.entityType, entityType),
      ),
    )
    .returning();

  return deletedImages;
}
