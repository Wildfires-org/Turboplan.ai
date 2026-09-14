import { eq } from "drizzle-orm";

import { chat, type SigningRecipientRow } from "@wildfires-org/turboplan-db";
import { db } from "@wildfires-org/turboplan-db/db-client";

import { stripSigningUrls } from "./queries";

// Best-effort audit context for timeline records on user-initiated actions.
// Documenso-driven events (sign/open/reject) are recorded by the webhook, where
// the IP/UA belong to Documenso's server, not the signer — so those are omitted.
export const getAuditContext = (c: {
  req: { header: (name: string) => string | undefined };
}): { ip: string | null; userAgent: string | null } => ({
  ip:
    c.req.header("cf-connecting-ip") ?? c.req.header("x-forwarded-for") ?? null,
  userAgent: c.req.header("user-agent") ?? null,
});

// Strips recipient bearer tokens (signingUrl) from any signing-request object
// before it is returned to a client. See stripSigningUrls in queries.ts — tokens
// are only handed out, scoped, by GET /:id/sign-token and GET /for-document.
export const sanitizeRequest = <
  T extends { recipients: SigningRecipientRow[] },
>(
  request: T | null,
): T | null => (request ? stripSigningUrls(request) : null);

// A signing request may only be advanced/abandoned by the user who requested it
// or by one of its recipients — not by an arbitrary project member.
export const isRequesterOrRecipient = (
  record: { userId: string | null; recipients: Array<{ userId: string }> },
  userId: string,
): boolean =>
  record.userId === userId ||
  record.recipients.some((r) => r.userId === userId);

// A document is bound to a project only through its chat. Reject when that
// binding is absent (null chatId — e.g. the chat was deleted, which sets it
// null) or points at a different project. Without this, a caller could render
// or sign an arbitrary document under any project they control, since the
// document is fetched by id alone with no project scoping.
export const isDocumentInProject = async (
  chatId: string | null,
  projectId: string,
): Promise<boolean> => {
  if (!chatId) {
    return false;
  }
  const [chatRecord] = await db
    .select({ projectId: chat.projectId })
    .from(chat)
    .where(eq(chat.id, chatId))
    .limit(1);
  return chatRecord?.projectId === projectId;
};
