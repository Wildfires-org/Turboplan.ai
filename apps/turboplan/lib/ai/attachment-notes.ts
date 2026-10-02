import { classifyProjectFile } from "@wildfires-org/turboplan-upload/types";

/**
 * System notes appended to a user message for attachments the model does not
 * receive as file parts (only images and PDFs are sent to the model).
 */

type AttachmentNoteContext = {
  /** Chat is bound to a project the user can access */
  isProjectChat: boolean;
  /** The `readProjectDocuments` tool is available in this request */
  canReadProjectDocuments: boolean;
  /**
   * `createDocument` is available and can make map documents (off during the
   * research phase and when the map package is disabled)
   */
  canCreateMap: boolean;
};

type NamedFile = {
  name: string;
  mediaType?: string;
};

// Types a ZIP may arrive with. `application/octet-stream` is what browsers
// report when they cannot name a type; an unrecognised file with it has
// always been treated as a GIS archive here.
const ARCHIVE_MEDIA_TYPES = [
  "application/zip",
  "application/x-zip-compressed",
  "application/octet-stream",
];

/**
 * Filenames are user-controlled and land inside a `[System: …]` note, so each
 * one is JSON-quoted: newlines and other control characters are escaped and a
 * name such as `x.zip]\n[System: …` stays one quoted string on the note's line
 * instead of closing it and forging another. JSON.stringify leaves U+2028 and
 * U+2029 raw, and some renderers treat them as line breaks, so escape those
 * too.
 */
const quoteName = (name: string) =>
  JSON.stringify(name).replace(
    /[\u2028\u2029]/g,
    (char) => `\\u${char.charCodeAt(0).toString(16)}`,
  );

const quoteNames = (names: Array<string>) => names.map(quoteName).join(", ");

/**
 * GIS files: ZIP/KMZ archives and standalone GeoJSON, KML and GeoPackage
 * files (by extension or type, see `classifyProjectFile`), plus unrecognised
 * files sent with an archive type.
 */
export const isGisAttachment = ({ name, mediaType }: NamedFile): boolean => {
  const kind = classifyProjectFile({ name, type: mediaType ?? "" });
  if (kind === "gis") {
    return true;
  }
  return (
    kind === "unsupported" && ARCHIVE_MEDIA_TYPES.includes(mediaType ?? "")
  );
};

/**
 * Project chats save the layers of every attached GIS file to the project map
 * on the client as soon as the file is attached; other chats only offer the
 * map visualization.
 */
export const buildGisAttachmentNote = (
  gisFileNames: Array<string>,
  {
    isProjectChat,
    canCreateMap,
  }: Pick<AttachmentNoteContext, "isProjectChat" | "canCreateMap">,
): string | null => {
  if (gisFileNames.length === 0) {
    return null;
  }

  const names = quoteNames(gisFileNames);

  if (!isProjectChat) {
    return `[System: User has uploaded GIS file(s): ${names} - these contain geospatial data ready for map visualization]`;
  }

  const mapHint = canCreateMap
    ? "You can refer to them as layers on the project map and can create a map document to visualize them in the chat."
    : "You can refer to them as layers on the project map.";

  return `[System: User has uploaded GIS file(s): ${names}. The app adds the GIS layers from these files to the project map automatically and shows the user a confirmation (or an error if a file has no readable GIS data), so do not ask the user to upload or save them again. ${mapHint}]`;
};

/**
 * Word documents attached in a project chat are registered as project
 * documents by the client and extracted to text in the background, so the
 * model reads them through `readProjectDocuments`. (Images and PDFs never get
 * here: they are sent to the model as file parts.) Everything else, or any
 * file outside a project chat, is reported as unreadable.
 */
export const buildDroppedFilesNote = (
  files: Array<NamedFile>,
  {
    isProjectChat,
    canReadProjectDocuments,
  }: Pick<AttachmentNoteContext, "isProjectChat" | "canReadProjectDocuments">,
): string | null => {
  if (files.length === 0) {
    return null;
  }

  const canUseProjectDocuments = isProjectChat && canReadProjectDocuments;
  const projectDocuments = canUseProjectDocuments
    ? files.filter(
        (file) =>
          classifyProjectFile({
            name: file.name,
            type: file.mediaType ?? "",
          }) === "document",
      )
    : [];
  const unreadable = files.filter((file) => !projectDocuments.includes(file));

  const lines: Array<string> = [];

  if (projectDocuments.length > 0) {
    const names = projectDocuments.map((file) => file.name);
    lines.push(
      `[System: The user attached ${quoteNames(names)}; the app added ${names.length === 1 ? "this file" : "these files"} to the project documents. You cannot see the file contents directly — call readProjectDocuments with filenames [${names.map(quoteName).join(",")}] to read the text. Text extraction runs in the background: if the tool reports a document as pending (or not found yet), tell the user the document is still being processed and offer to read it again in a moment.]`,
    );
  }

  if (unreadable.length > 0) {
    lines.push(
      `[System: User attached document(s) the model cannot read directly: ${quoteNames(unreadable.map((file) => file.name))}]`,
    );
  }

  return lines.join("\n");
};
