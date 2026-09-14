/**
 * Server interfaces for map artifact
 * Follows Single Responsibility Principle
 */

import type { UIMessageStreamWriter } from "ai";

import type { Session } from ".";

export interface SaveDocumentProps {
  id: string;
  title: string;
  kind: "map";
  content: string;
  userId: string;
}

export interface CreateDocumentCallbackProps {
  id: string;
  title: string;
  userContext?: string;
  writer: UIMessageStreamWriter;
  session: Session;
  projectId?: string;
  attachments?: Array<{ url: string; name?: string; contentType?: string }>;
}

export interface UpdateDocumentCallbackProps {
  document: {
    id: string;
  };
  description: string;
  writer: UIMessageStreamWriter;
  session: Session;
}

export interface MapStreamData {
  type: "map-delta";
}
