/**
 * Server-side upload utilities
 *
 * This file exports the UploadService, router, and related utilities.
 */

export { isSafeObjectKey, LANDING_UPLOAD_PREFIX } from "../types";
export {
  type ClaimedLandingUpload,
  claimLandingUpload,
  getLandingUploadDestination,
  type InspectedLandingUpload,
  inspectLandingUpload,
  type LandingUploadDestination,
} from "./landing-uploads";
export { publicUploadRouter } from "./public-router";
export {
  canonicalStorageKey,
  canonicalStorageUrl,
  deleteFile,
  deleteOwnedStorageFile,
  deleteReplacedStorageFiles,
  generatePresignedUploadUrl,
  getObjectBytes,
  isAllowedStorageUrlUpdate,
  isOwnedUploadUrl,
  isStorageHost,
  isStorageUrl,
  isStorageUrlOwnedBy,
  orgLogoStorageKey,
  ownedUploadKey,
  type ReplacedStorageField,
  resetR2Client,
  type StorageObjectBytes,
  type StorageOwner,
  uploadFile,
} from "./r2-client";
export { type CappedReadFailure, readCapped } from "./read-capped";
export { uploadRouter } from "./router";
export { uniqueStorageName } from "./storage-key";
export {
  UploadService,
  uploadService,
} from "./UploadService";
