import {
  isProjectDocumentMimeType,
  normalizeContentType,
  PROJECT_DOCUMENT_MAX_FILE_SIZE,
  type ProjectDocumentMimeType,
  parseLandingUploadKey,
  UploadError,
  UploadErrorCode,
} from "../types";
import {
  canonicalStorageKey,
  copyStorageObject,
  deleteStorageObject,
  getPublicUrl,
  headStorageObject,
  isSafeKeySegment,
} from "./r2-client";

/**
 * Stripped from a landing filename on top of `sanitizeFilename`: `#` and `%`
 * do not survive the object's public URL (fragment / percent-decoding), and
 * Unicode control and format characters (e.g. RTLO) can spoof the shown name.
 */
export const LANDING_FILENAME_STRIP_CHARS = /[#%\p{Cc}\p{Cf}]/gu;

/** A staging upload as storage reports it, checked against the claim rules. */
export type InspectedLandingUpload = {
  /** The visitor's (sanitized) filename, without the unique prefix */
  originalFilename: string;
  /** Size reported by storage */
  size: number;
  /** Content type reported by storage, normalized */
  contentType: ProjectDocumentMimeType;
  etag: string | undefined;
};

const requireLandingUploadKey = (key: string) => {
  const parsed = parseLandingUploadKey(key);
  if (!parsed) {
    throw new UploadError(
      "Invalid landing upload key",
      UploadErrorCode.VALIDATION_ERROR,
      { key },
    );
  }
  return parsed;
};

/**
 * Read a staging upload's stored type and size (HEAD) and apply the project
 * document rules to them, without consuming it. The single validation used
 * both by `claimLandingUpload` and by callers that need to know beforehand
 * which uploads a claim will accept.
 *
 * Returns null when no object exists at `key` (expired, already claimed,
 * never uploaded). Throws an `UploadError` for a malformed key or a
 * disallowed object, and passes storage errors through.
 */
export const inspectLandingUpload = async (
  key: string,
): Promise<InspectedLandingUpload | null> => {
  const { originalFilename } = requireLandingUploadKey(key);

  const object = await headStorageObject(key);
  if (!object) {
    return null;
  }

  const contentType = normalizeContentType(object.contentType);
  if (!isProjectDocumentMimeType(contentType)) {
    throw new UploadError(
      "Unsupported file type",
      UploadErrorCode.VALIDATION_ERROR,
      { key, contentType: object.contentType },
    );
  }

  if (object.size <= 0 || object.size > PROJECT_DOCUMENT_MAX_FILE_SIZE) {
    throw new UploadError(
      `File size ${object.size} is outside the allowed range`,
      UploadErrorCode.VALIDATION_ERROR,
      { key, size: object.size, maxSize: PROJECT_DOCUMENT_MAX_FILE_SIZE },
    );
  }

  return {
    originalFilename,
    size: object.size,
    contentType,
    etag: object.etag,
  };
};

export type ClaimedLandingUpload = {
  /** Public URL of the object at its new key */
  url: string;
  /** New key, under `uploads/{userId}/` */
  key: string;
  /** Size reported by storage */
  size: number;
  /** Content type reported by storage */
  contentType: ProjectDocumentMimeType;
  originalFilename: string;
};

/**
 * Move a landing-page staging upload into `userId`'s own upload prefix, so it
 * can be registered as a project document like any upload of theirs.
 *
 * Type and size come from storage (`inspectLandingUpload`), never from the
 * client. The copy is pinned to the inspected ETag and stored with the
 * validated type. The staging object is then deleted best-effort.
 *
 * Returns null when no object exists at `key` (expired, already claimed).
 * Throws an `UploadError` for a malformed key or a disallowed object, and
 * passes storage errors through.
 */
export const claimLandingUpload = async (
  key: string,
  userId: string,
): Promise<ClaimedLandingUpload | null> => {
  const { segment } = requireLandingUploadKey(key);

  if (!isSafeKeySegment(userId)) {
    throw new UploadError(
      "Invalid upload owner",
      UploadErrorCode.VALIDATION_ERROR,
    );
  }

  const destinationKey = `uploads/${userId}/${segment}`;
  const url = getPublicUrl(destinationKey);

  // The registered URL must resolve back to this exact key, or ownership
  // checks and deletes would later act on a different object.
  if (canonicalStorageKey(url) !== destinationKey) {
    throw new UploadError(
      "Landing upload key does not map to a storage URL",
      UploadErrorCode.VALIDATION_ERROR,
      { key },
    );
  }

  const upload = await inspectLandingUpload(key);
  if (!upload) {
    return null;
  }

  // Pinned to the inspected ETag, and the stored type is rewritten to the one
  // validated above: the ETag covers the body only, so a same-bytes re-upload
  // with another type between HEAD and COPY would otherwise carry it over.
  await copyStorageObject(key, destinationKey, {
    ifMatch: upload.etag,
    contentType: upload.contentType,
  });

  try {
    await deleteStorageObject(key);
  } catch (error) {
    // The copy is what matters; a leftover staging object expires on its own.
    console.warn("Failed to delete claimed landing upload:", key, error);
  }

  return {
    url,
    key: destinationKey,
    size: upload.size,
    contentType: upload.contentType,
    originalFilename: upload.originalFilename,
  };
};
