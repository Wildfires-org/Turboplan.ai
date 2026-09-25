/**
 * Server-side upload utilities
 *
 * This file exports the UploadService, router, and related utilities.
 */

export {
  canonicalStorageKey,
  deleteFile,
  deleteOwnedStorageFile,
  deleteReplacedStorageFiles,
  generatePresignedUploadUrl,
  isAllowedStorageUrlUpdate,
  isOwnedUploadUrl,
  isStorageUrl,
  isStorageUrlOwnedBy,
  orgLogoStorageKey,
  type ReplacedStorageField,
  resetR2Client,
  type StorageOwner,
  uploadFile,
} from "./r2-client";
export { uploadRouter } from "./router";
export { uniqueStorageName } from "./storage-key";
export {
  UploadService,
  uploadService,
} from "./UploadService";
