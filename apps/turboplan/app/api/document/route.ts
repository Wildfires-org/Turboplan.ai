import {
  deleteDocumentsByIdAfterTimestamp,
  getDocumentsById,
  saveDocument,
} from "@wildfires-org/turboplan-db/queries";

import { auth } from "@/app/(auth)/auth";
import { ArtifactKind } from "@/components/artifact";
import { hasDocumentAccess } from "@/lib/api/document-access";
import { ErrorResponses } from "@/lib/api/utils";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return ErrorResponses.badRequest("Missing id");
  }

  const session = await auth();

  if (!session || !session.user?.id) {
    return ErrorResponses.unauthorized();
  }

  const userId = session.user.id;
  const documents = await getDocumentsById({ id });

  const [document] = documents;

  if (!document) {
    return ErrorResponses.notFound();
  }

  const canRead = await hasDocumentAccess({
    documentId: id,
    documentOwnerId: document.userId,
    userId,
    access: "read",
  });

  if (!canRead) {
    return ErrorResponses.forbidden();
  }

  return Response.json(documents, { status: 200 });
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return ErrorResponses.badRequest("Missing id");
  }

  const session = await auth();

  if (!session?.user?.id) {
    return ErrorResponses.unauthorized();
  }

  const {
    content,
    title,
    kind,
  }: { content: string; title: string; kind: ArtifactKind } =
    await request.json();

  const userId = session.user.id;

  // Preserve chatId from earlier versions of this document
  const existingDocs = await getDocumentsById({ id });
  const existingDoc = existingDocs[0];

  // If this document id already belongs to another user, require write
  // permission on the owning project before allowing an overwrite (a new
  // version row) — read-only members must not be able to save over it.
  if (existingDoc) {
    const canWrite = await hasDocumentAccess({
      documentId: id,
      documentOwnerId: existingDoc.userId,
      userId,
      access: "write",
    });

    if (!canWrite) {
      return ErrorResponses.forbidden();
    }
  }

  const chatId = existingDoc?.chatId ?? undefined;

  const document = await saveDocument({
    id,
    content,
    title,
    kind,
    userId,
    chatId,
  });

  return Response.json(document, { status: 200 });
}

export async function PATCH(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  const { timestamp }: { timestamp: string } = await request.json();

  if (!id) {
    return ErrorResponses.badRequest("Missing id");
  }

  const session = await auth();

  if (!session?.user?.id) {
    return ErrorResponses.unauthorized();
  }

  const documents = await getDocumentsById({ id });

  const [document] = documents;

  if (!document) {
    return ErrorResponses.notFound();
  }

  // Dropping later versions is a write, so it takes the same permission as
  // saving one.
  const canWrite = await hasDocumentAccess({
    documentId: id,
    documentOwnerId: document.userId,
    userId: session.user.id,
    access: "write",
  });

  if (!canWrite) {
    return ErrorResponses.forbidden();
  }

  await deleteDocumentsByIdAfterTimestamp({
    id,
    timestamp: new Date(timestamp),
  });

  return new Response("Deleted", { status: 200 });
}
