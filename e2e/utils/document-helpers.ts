import { randomUUID } from "node:crypto";

import { createToken } from "@wildfires-org/turboplan-api-client/server";
import {
  deleteDocumentLetterhead,
  listDocumentLetterheads,
  saveDocument,
  saveMessages,
} from "@wildfires-org/turboplan-db/queries";
import { createOrganizationUser } from "@wildfires-org/turboplan-workspace/server";

import { createTestUserWithMagicLink } from "./test-auth";
import { createTestProjectChat } from "./test-chats";
import {
  createTestProjectInOffice,
  getTestOffice,
  getTestUserOrganization,
} from "./test-invitations";

export type ApiTestUser = {
  id: string;
  email: string;
  /** Bearer token for the Hono API server. */
  token: string;
};

/** A fresh user's personal org + office (owner) and a project in that office. */
export type OwnedWorkspace = {
  owner: ApiTestUser;
  organizationId: string;
  officeId: string;
  projectId: string;
};

const shortId = (): string => Math.random().toString(36).substring(2, 8);

/** `Authorization` header for a test user's API calls. */
export const authHeaders = (user: ApiTestUser): Record<string, string> => ({
  Authorization: `Bearer ${user.token}`,
});

/**
 * Create a verified user (with its personal org + office, as at sign-up) and
 * an API token for it. Each call uses a unique email, so specs never share
 * users with each other or with retries.
 */
export const createApiTestUser = async (
  prefix: string,
): Promise<ApiTestUser> => {
  const { user } = await createTestUserWithMagicLink(
    `${prefix}-${Date.now()}-${shortId()}@example.com`,
  );
  const token = await createToken({ id: user.id });
  return { id: user.id, email: user.email, token };
};

/**
 * A fresh owner with a project in their personal office. Isolated from the
 * shared citizen/gov workspaces, so changing its letterhead or document
 * details cannot leak into other specs.
 */
export const createOwnedWorkspace = async (
  prefix: string,
): Promise<OwnedWorkspace> => {
  const owner = await createApiTestUser(prefix);

  const organization = await getTestUserOrganization(owner.id);
  if (!organization) {
    throw new Error(`Personal organization not found for ${owner.email}`);
  }

  const office = await getTestOffice(organization.id);
  if (!office) {
    throw new Error(`Personal office not found for ${owner.email}`);
  }

  const project = await createTestProjectInOffice({
    name: `${prefix} project ${shortId()}`,
    officeId: office.id,
    createdBy: owner.id,
  });

  return {
    owner,
    organizationId: organization.id,
    officeId: office.id,
    projectId: project.id,
  };
};

/** Add a user to an organization as a viewer (READ, no UPDATE). */
export const addOrganizationViewer = async (params: {
  organizationId: string;
  userId: string;
}): Promise<void> => {
  await createOrganizationUser({ ...params, role: "viewer" });
};

/**
 * Seed a project chat holding a saved text document, the way a finished
 * `createDocument` tool call leaves it: the `document` row (linked to the chat,
 * which ties it to the project) plus a user message and an assistant message
 * whose `tool-createDocument` part renders the clickable document preview.
 * No model is called.
 */
export const seedChatDocument = async (params: {
  userId: string;
  projectId: string;
  title: string;
  content: string;
}): Promise<{ chatId: string; chatTitle: string; documentId: string }> => {
  const { userId, projectId, title, content } = params;
  const chat = await createTestProjectChat({
    userId,
    projectId,
    title: `${title} chat`,
  });
  const documentId = randomUUID();

  await saveDocument({
    id: documentId,
    title,
    kind: "text",
    content,
    userId,
    chatId: chat.id,
  });

  const now = Date.now();
  await saveMessages({
    messages: [
      {
        id: randomUUID(),
        chatId: chat.id,
        role: "user",
        parts: [{ type: "text", text: `Draft "${title}"` }],
        attachments: [],
        createdAt: new Date(now),
      },
      {
        id: randomUUID(),
        chatId: chat.id,
        role: "assistant",
        parts: [
          { type: "step-start" },
          {
            type: "tool-createDocument",
            toolCallId: `call_${shortId()}`,
            state: "output-available",
            input: { title, kind: "text" },
            output: {
              id: documentId,
              title,
              kind: "text",
              content: "A document was created and is now visible to the user.",
            },
          },
          { type: "text", text: "Here is the draft." },
        ],
        attachments: [],
        createdAt: new Date(now + 1),
      },
    ],
  });

  return { chatId: chat.id, chatTitle: chat.title, documentId };
};

/**
 * Delete an organization's library letterheads whose name starts with
 * `namePrefix` — cleanup for specs that create them in a shared organization
 * (an org keeps at most 20, so leftovers from failed runs would add up).
 */
export const deleteLibraryLetterheadsByPrefix = async (
  organizationId: string,
  namePrefix: string,
): Promise<void> => {
  const rows = await listDocumentLetterheads(organizationId);
  for (const row of rows) {
    if (row.name.startsWith(namePrefix)) {
      await deleteDocumentLetterhead(organizationId, row.id);
    }
  }
};
