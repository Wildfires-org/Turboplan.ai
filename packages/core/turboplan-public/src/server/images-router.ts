/**
 * Public Images Router
 *
 * Endpoints for serving public project images without authentication.
 * Only serves images that belong to public projects.
 */

import { Hono } from "hono";

import { getGeneratedImageById } from "@wildfires-org/turboplan-db/queries";

import { getPublicProjectByImageId } from "../queries/images";

export const publicImagesRouter = new Hono();

/**
 * GET /images/:imageId - Redirect to the generated image
 *
 * Redirects to the actual image URL for cover images.
 * Only serves images that belong to public projects to prevent leaking
 * images from private projects.
 */
publicImagesRouter.get("/:imageId", async (c) => {
  try {
    const imageId = c.req.param("imageId");

    // Verify the image belongs to a public project before serving
    const publicProject = await getPublicProjectByImageId(imageId);
    if (!publicProject) {
      return c.json({ error: "Image not found" }, 404);
    }

    const image = await getGeneratedImageById(imageId);
    if (!image || !image.imageUrl) {
      return c.json({ error: "Image not found" }, 404);
    }

    return c.redirect(image.imageUrl, 302);
  } catch (error) {
    console.error("Failed to get image:", error);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});
