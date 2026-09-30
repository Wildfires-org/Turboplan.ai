/**
 * What a user can drop into a project as context: documents (PDF / Word) and
 * GIS files (zipped shapefile / file geodatabase, GeoJSON, KML / KMZ,
 * GeoPackage). Shared by the client
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

/** GIS file extensions and the content type each is uploaded with. */
const KML_MIME_TYPE = "application/vnd.google-earth.kml+xml";

/**
 * KML is uploaded as `text/plain`, never as its `+xml` type: storage serves
 * files inline from a public origin, and an XML document there can run
 * script (stored XSS), so the upload allow list refuses the `+xml` type.
 */
const KML_UPLOAD_CONTENT_TYPE = "text/plain";

const GIS_EXTENSION_CONTENT_TYPES = {
  ".zip": "application/zip",
  ".kmz": "application/vnd.google-earth.kmz",
  ".kml": KML_UPLOAD_CONTENT_TYPE,
  ".geojson": "application/geo+json",
  ".gpkg": "application/geopackage+sqlite3",
} as const;

/**
 * GIS files a project accepts: zipped shapefiles / file geodatabases, KMZ,
 * KML, GeoJSON and GeoPackage. Bare `.json` is deliberately not one of them.
 */
export const GIS_FILE_EXTENSIONS = Object.keys(
  GIS_EXTENSION_CONTENT_TYPES,
) as (keyof typeof GIS_EXTENSION_CONTENT_TYPES)[];

/**
 * GIS MIME types browsers report (Windows uses the x- variant for ZIPs). Used
 * to classify dropped files only; uploads use {@link GIS_UPLOAD_CONTENT_TYPES}.
 */
export const GIS_MIME_TYPES = [
  "application/zip",
  "application/x-zip-compressed",
  "application/vnd.google-earth.kmz",
  KML_MIME_TYPE,
  "application/geo+json",
  "application/geopackage+sqlite3",
] as const;

/**
 * Content types a GIS file can be uploaded with, i.e. what
 * {@link resolveProjectFileContentType} returns for one: the GIS MIME types
 * with KML swapped for `text/plain`.
 */
export const GIS_UPLOAD_CONTENT_TYPES = [
  ...GIS_MIME_TYPES.filter((mimeType) => mimeType !== KML_MIME_TYPE),
  KML_UPLOAD_CONTENT_TYPE,
];

/**
 * Maximum GIS file size: 100MB. The map processing service buffers the
 * download in memory and refuses anything larger, so reject it before upload.
 */
export const GIS_MAX_FILE_SIZE = 100 * 1024 * 1024;

/** `accept` value for a file input that takes documents and GIS files. */
export const PROJECT_FILE_ACCEPT = [
  PROJECT_DOCUMENT_ACCEPT,
  ...GIS_MIME_TYPES,
  ...GIS_FILE_EXTENSIONS,
].join(",");

export type ProjectFileKind = "document" | "gis" | "unsupported";

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

const isGisExtension = (
  extension: string,
): extension is keyof typeof GIS_EXTENSION_CONTENT_TYPES => {
  return Object.keys(GIS_EXTENSION_CONTENT_TYPES).includes(extension);
};

const isGisMimeType = (mimeType: string) => {
  return (GIS_MIME_TYPES as readonly string[]).includes(mimeType);
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
  if (isGisExtension(extension)) {
    return "gis";
  }
  if (isProjectDocumentMimeType(file.type)) {
    return "document";
  }
  if (isGisMimeType(file.type)) {
    return "gis";
  }
  return "unsupported";
};

/**
 * Legacy binary Word (.doc): accepted and stored, but the text extractor
 * cannot read it, so the assistant never sees its contents.
 */
export const isLegacyWordDocument = (file: FileLike): boolean => {
  const extension = getExtension(file.name);
  if (extension === ".doc") {
    return true;
  }
  return extension !== ".docx" && file.type === "application/msword";
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

  if (kind === "gis") {
    const extension = getExtension(file.name);
    if (extension === ".kml" || file.type === KML_MIME_TYPE) {
      return KML_UPLOAD_CONTENT_TYPE;
    }
    if (isGisMimeType(file.type)) {
      return file.type;
    }
    return isGisExtension(extension)
      ? GIS_EXTENSION_CONTENT_TYPES[extension]
      : null;
  }

  return null;
};

/** Size limit for a classified file, or null for unsupported files. */
export const getProjectFileMaxSize = (kind: ProjectFileKind): number | null => {
  if (kind === "document") {
    return PROJECT_DOCUMENT_MAX_FILE_SIZE;
  }
  if (kind === "gis") {
    return GIS_MAX_FILE_SIZE;
  }
  return null;
};
