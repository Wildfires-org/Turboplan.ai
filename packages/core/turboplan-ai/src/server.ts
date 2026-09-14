/**
 * Server-side AI routes and services
 * Export Hono routers for use in Next.js API routes
 */

export { generateObject, generateText } from "ai";

export type { ResolvedModelConfig } from "./server/models";
// Export model resolution functions
export { getImageModel, getModel } from "./server/models";
export { imageGenerationRouter } from "./server/routes/image-generation";
export type { GenerateImageInput } from "./server/validation";
export { generateImageSchema } from "./server/validation";
// Export service functions for direct use in backend
export {
  type AutoGenerationResult,
  autoGenerateProjectCoverImage,
  autoGenerateTemplateCoverImage,
} from "./services/image-generation-service";
