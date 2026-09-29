import { createProjectDocument } from "@wildfires-org/turboplan-db/queries";
import {
  uniqueStorageName,
  uploadFile,
} from "@wildfires-org/turboplan-upload/server";

import type { DocumensoConfig } from "./config-resolver";
import { downloadSignedDocument } from "./documenso-client";

type PersistableRequest = {
  projectId: string;
  envelopeId: string;
  title: string;
};

export type PersistedSignedDocument = {
  url: string;
  filename: string;
  originalFilename: string;
  size: number;
};

/**
 * Downloads the sealed PDF from Documenso, uploads it to blob storage, and
 * creates the corresponding project document record. Shared by the synchronous
 * `/complete` endpoint and the asynchronous DOCUMENT_COMPLETED webhook so the
 * two paths can't drift. Status/timeline updates stay with the caller because
 * they differ between the two paths.
 */
export const persistSignedDocument = async (
  record: PersistableRequest,
  userId: string,
  config: DocumensoConfig | null,
): Promise<PersistedSignedDocument> => {
  const pdfBuffer = await downloadSignedDocument(record.envelopeId, config);

  const safeTitle = record.title.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filename = `signed/${record.projectId}/${uniqueStorageName(`${safeTitle}.pdf`)}`;
  const { url } = await uploadFile(filename, pdfBuffer, "application/pdf");

  const originalFilename = `${record.title} (Signed).pdf`;
  const size = pdfBuffer.byteLength;

  await createProjectDocument({
    projectId: record.projectId,
    userId,
    filename,
    originalFilename,
    mimeType: "application/pdf",
    size,
    url,
  });

  return { url, filename, originalFilename, size };
};
