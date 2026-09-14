# @wildfires-org/turboplan-documents

Document upload and management UI for TurboPlan projects (PDF and Word files) with drag-and-drop, previews, and SWR-backed data fetching.

## Installation

Internal workspace package — add it to a consuming app or package:

```json
{
  "dependencies": {
    "@wildfires-org/turboplan-documents": "workspace:*"
  }
}
```

## Feature Flag

Controlled by the `documents` feature flag from `@wildfires-org/turboplan-feature-flags` (`isDocumentsPackageEnabled()`):

- **Client-side (Next.js)**: `NEXT_PUBLIC_IS_DOCUMENTS_PACKAGE_ENABLED`
- **Server-side (Hono)**: `IS_DOCUMENTS_PACKAGE_ENABLED`

## Exports

### Client (`./client`)

- `DocumentsSectionUI` — documents section with drag-and-drop upload
- `ProjectDocumentsSection` — full project documents section (wires hook + UI)
- `DocumentsReadOnlyList` — read-only document list (e.g. public project pages)
- `DocumentCardEditable` — single document card with edit/delete actions
- `DocumentPreviewDialog` — in-app PDF/Word preview (react-pdf, docx-preview)
- `useProjectDocuments` — hook for list/upload/delete with optimistic SWR cache updates
- `uploadBlobToProject` — non-hook upload helper
- Constants: `ALLOWED_MIME_TYPES`, `MAX_FILE_SIZE`, `ACCEPT_STRING`

### Server (`./server`)

- `getProjectDocumentsContext(projectId)` — formats saved project documents as a system-prompt context block for the AI chat

### Types (`./types`)

- `ProjectDocument`, `ProjectDocumentSource`, `ProjectDocumentUploader`
- `UseProjectDocumentsOptions`, `UseProjectDocumentsReturn`

## Usage

```tsx
import {
  DocumentsSectionUI,
  useProjectDocuments,
} from "@wildfires-org/turboplan-documents/client";

function MyDocumentsSection({ projectId, userId }) {
  const { documents, uploadDocument, isUploading, uploadProgress } =
    useProjectDocuments({ projectId });

  return (
    <DocumentsSectionUI
      projectId={projectId}
      userId={userId}
      onFileUpload={uploadDocument}
      isUploading={isUploading}
      uploadProgress={uploadProgress}
    />
  );
}
```

## Upload Flow

1. **User drops file** → `useProjectDocuments.uploadDocument()` is called
2. **Client validation** → file type (PDF, DOC, DOCX) and size (max 50MB) checked
3. **Presign request** → client requests a presigned upload URL from the server (via `@wildfires-org/turboplan-upload`)
4. **Direct upload** → file uploads directly to Cloudflare R2 storage (bypasses serverless body limits)
5. **DB record** → client creates the document record via `POST /api/project-documents`
6. **Cache update** → SWR cache updated optimistically

### Supported File Types

- PDF (`.pdf`)
- Microsoft Word (`.doc`, `.docx`)

### File Size Limit

- Maximum 50MB per file

## Authorization

Enforced by the `project-documents` routes in `@wildfires-org/turboplan-workspace` (mounted at `/api/project-documents` in `apps/server`):

- **View**: `READ` permission on the project (Viewer+)
- **Upload**: `UPDATE` permission on the project (Editor+)
- **Delete**: document uploader OR `UPDATE` permission on the project

## Related Packages

- `@wildfires-org/turboplan-upload` — generic upload infrastructure (presigned URLs, Cloudflare R2 object storage)
- `@wildfires-org/turboplan-workspace` — project documents API routes
- `@wildfires-org/turboplan-rbac` — permission checks
