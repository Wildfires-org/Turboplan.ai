import {
  getDocumentsById,
  getSuggestionsByDocumentId,
} from "@wildfires-org/turboplan-db/queries";

import { auth } from "@/app/(auth)/auth";
import { hasDocumentAccess } from "@/lib/api/document-access";
import { ErrorResponses } from "@/lib/api/utils";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const documentId = searchParams.get("documentId");

  if (!documentId) {
    return ErrorResponses.badRequest("documentId is required");
  }

  const session = await auth();

  if (!session || !session.user?.id) {
    return ErrorResponses.unauthorized();
  }

  const userId = session.user.id;

  // Authorize on the DOCUMENT, mirroring GET /api/document: owner, or a member
  // of the project the document belongs to. The previous per-author filter
  // hid collaborators' suggestions from each other and silently returned an
  // empty list to callers with no access at all.
  const [document] = await getDocumentsById({ id: documentId });

  if (!document) {
    return ErrorResponses.notFound();
  }

  const canRead = await hasDocumentAccess({
    documentId,
    documentOwnerId: document.userId,
    userId,
    access: "read",
  });

  if (!canRead) {
    return ErrorResponses.forbidden();
  }

  const suggestions = await getSuggestionsByDocumentId({
    documentId,
  });

  return Response.json(suggestions, { status: 200 });
}
