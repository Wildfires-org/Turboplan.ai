/**
 * What a user can drop into a project as context: documents (PDF / Word) and
 * zipped GIS layers (shapefile / file geodatabase). Shared by the client
 * dropzones and the server-side document registration check, so the rules
 * cannot drift apart.
 */

/** Document MIME types a project accepts, with the extensions each maps to. */
export const PROJECT_DOCUMENT_MIME_TYPES = {
  "application/pdf": [".pdf"],
  "application/msword": [".doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    ".docx",
  ],
} as const satisfies Record<string, readonly string[]>;

export type ProjectDocumentMimeType = keyof typeof PROJECT_DOCUMENT_MIME_TYPES;

/** Maximum project document size: 50MB. */
export const PROJECT_DOCUMENT_MAX_FILE_SIZE = 50 * 1024 * 1024;

/** `accept` value for a file input limited to project documents. */
export const PROJECT_DOCUMENT_ACCEPT = Object.entries(
  PROJECT_DOCUMENT_MIME_TYPES,
)
  .flatMap(([mimeType, extensions]) => [mimeType, ...extensions])
  .join(",");

/** ZIP MIME types browsers report (Windows uses the x- variant). */
export const GIS_ARCHIVE_MIME_TYPES = [
  "application/zip",
  "application/x-zip-compressed",
] as const;

/**
 * Maximum GIS archive size: 100MB. The map processing service buffers the
 * download in memory and refuses anything larger, so reject it before upload.
 */
export const GIS_ARCHIVE_MAX_FILE_SIZE = 100 * 1024 * 1024;

/** `accept` value for a file input that takes documents and GIS archives. */
export const PROJECT_FILE_ACCEPT = [
  PROJECT_DOCUMENT_ACCEPT,
  ...GIS_ARCHIVE_MIME_TYPES,
  ".zip",
].join(",");

export type ProjectFileKind = "document" | "gis-zip" | "unsupported";

type FileLike = {
  name: string;
  type: string;
};

const getExtension = (name: string) => {
  const dotIndex = name.lastIndexOf(".");
  if (dotIndex <= 0) {
    return "";
  }
  return name.slice(dotIndex).toLowerCase();
};

const findDocumentMimeTypeByExtension = (
  extension: string,
): ProjectDocumentMimeType | null => {
  const match = Object.entries(PROJECT_DOCUMENT_MIME_TYPES).find(
    ([, extensions]) => (extensions as readonly string[]).includes(extension),
  );
  return match ? (match[0] as ProjectDocumentMimeType) : null;
};

/** True when `mimeType` is one of the project document types. */
export const isProjectDocumentMimeType = (
  mimeType: string,
): mimeType is ProjectDocumentMimeType => {
  return Object.keys(PROJECT_DOCUMENT_MIME_TYPES).includes(mimeType);
};

/**
 * Sorts a picked or dropped file into what the project does with it. The
 * extension decides first because browsers report ZIP and Word files
 * inconsistently (an empty type or `application/octet-stream` is common).
 */
export const classifyProjectFile = (file: FileLike): ProjectFileKind => {
  const extension = getExtension(file.name);

  if (findDocumentMimeTypeByExtension(extension)) {
    return "document";
  }
  if (extension === ".zip") {
    return "gis-zip";
  }
  if (isProjectDocumentMimeType(file.type)) {
    return "document";
  }
  if ((GIS_ARCHIVE_MIME_TYPES as readonly string[]).includes(file.type)) {
    return "gis-zip";
  }
  return "unsupported";
};

/**
 * The content type to upload a classified file with. Keeps the browser's type
 * when it is already an allowed one, otherwise derives it from the extension,
 * so the upload allow list does not reject a file only because the browser
 * could not name its type. Returns null for unsupported files.
 */
export const resolveProjectFileContentType = (
  file: FileLike,
): string | null => {
  const kind = classifyProjectFile(file);

  if (kind === "document") {
    if (isProjectDocumentMimeType(file.type)) {
      return file.type;
    }
    return findDocumentMimeTypeByExtension(getExtension(file.name));
  }

  if (kind === "gis-zip") {
    if ((GIS_ARCHIVE_MIME_TYPES as readonly string[]).includes(file.type)) {
      return file.type;
    }
    return "application/zip";
  }

  return null;
};

/** Size limit for a classified file, or null for unsupported files. */
export const getProjectFileMaxSize = (kind: ProjectFileKind): number | null => {
  if (kind === "document") {
    return PROJECT_DOCUMENT_MAX_FILE_SIZE;
  }
  if (kind === "gis-zip") {
    return GIS_ARCHIVE_MAX_FILE_SIZE;
  }
  return null;
};
