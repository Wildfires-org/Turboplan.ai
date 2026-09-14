/**
 * Uploader information for a project document
 */
export interface ProjectDocumentUploader {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

/**
 * Origin of a project document. "upload" for manual/chat uploads (Documents
 * page), "research" for research-agent results (Context page).
 */
export type ProjectDocumentSource = "upload" | "research";

/**
 * Project document data structure
 */
export interface ProjectDocument {
  id: string;
  projectId: string;
  userId: string | null;
  filename: string;
  originalFilename: string;
  mimeType: string;
  size: number;
  url: string;
  source: ProjectDocumentSource;
  folder?: string | null;
  folderDescription?: string | null;
  createdAt: string;
  uploader: ProjectDocumentUploader | null;
}

/**
 * Options for the useProjectDocuments hook
 */
export interface UseProjectDocumentsOptions {
  projectId: string;
  /** Only fetch documents of this origin. Omit to fetch all. */
  source?: ProjectDocumentSource;
}

/**
 * Return type for the useProjectDocuments hook
 */
export interface UseProjectDocumentsReturn {
  documents: ProjectDocument[];
  isLoading: boolean;
  error: string | null;
  uploadDocument: (file: File) => Promise<ProjectDocument | undefined>;
  deleteDocument: (documentId: string) => Promise<void>;
  renameDocument: (documentId: string, newName: string) => Promise<void>;
  isUploading: boolean;
  uploadProgress: number;
  uploadError: Error | null;
  resetUpload: () => void;
  isDeleting: string | null;
  isRenaming: string | null;
  refreshDocuments: () => Promise<ProjectDocument[] | undefined>;
}
