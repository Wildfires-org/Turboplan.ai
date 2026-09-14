import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNotNull,
  lt,
  SQL,
} from "drizzle-orm";

import {
  generateSlug,
  generateUniqueSlug,
} from "@wildfires-org/turboplan-utils/server";

import { db } from "../db-client";
import {
  type Chat,
  chat,
  type DBMessage,
  document,
  message,
  OrganizationType,
  office,
  officeUsers,
  organization,
  organizationUsers,
  profile,
  project,
  type Suggestion,
  suggestion,
  type User,
  UserRole,
  user,
} from "../schemas";

export async function getUser(email: string): Promise<Array<User>> {
  try {
    // Normalize email for consistent lookup (trim and lowercase)
    const normalizedEmail = email.trim().toLowerCase();
    return await db.select().from(user).where(eq(user.email, normalizedEmail));
  } catch (error) {
    console.log(error);
    console.error("Failed to get user from database");
    throw error;
  }
}

export async function getUserById(
  id: string,
): Promise<Pick<User, "id" | "email" | "emailVerified"> | null> {
  try {
    const [foundUser] = await db
      .select({
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
      })
      .from(user)
      .where(eq(user.id, id));
    return foundUser ?? null;
  } catch (error) {
    console.error("Failed to get user by id from database");
    throw error;
  }
}

// Low-level database function: creates only the user record
async function createUserRecord(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  email: string,
) {
  const normalizedEmail = email.trim().toLowerCase();

  const [newUser] = await tx
    .insert(user)
    .values({ email: normalizedEmail })
    .returning();

  return newUser;
}

// Low-level database function: creates personal organization for user
async function createPersonalOrganizationForUser(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  userId: string,
  email: string,
) {
  const emailPrefix = email.split("@")[0];
  const orgName = `${emailPrefix}'s Organization`;
  const orgSlug = generateUniqueSlug(orgName);
  const now = new Date();

  const [newOrg] = await tx
    .insert(organization)
    .values({
      slug: orgSlug,
      name: orgName,
      description: `Personal workspace for ${email}`,
      type: OrganizationType.PERSONAL,
      status: "active",
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  // Assign user as owner
  await tx.insert(organizationUsers).values({
    userId,
    organizationId: newOrg.id,
    role: "owner",
  });

  // Create the default "My Projects" office inside the personal org. This is
  // the ONLY personal office; every flow (self-service signup, logged-in
  // landing-page project creation, templates) resolves it via
  // getOrCreatePersonalWorkspace and must never create a second one.
  const officeSlug = generateSlug("My Projects");
  const [newOffice] = await tx
    .insert(office)
    .values({
      name: "My Projects",
      slug: officeSlug,
      description: "Your personal office",
      organizationId: newOrg.id,
      createdBy: userId,
      status: "active",
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  await tx.insert(officeUsers).values({
    userId,
    officeId: newOffice.id,
    role: "owner",
  });

  return newOrg;
}

// Low-level database function: creates a profile, optionally with a role.
// Self-service registration captures the role on the landing page, so it is
// persisted here rather than left null for a later onboarding step.
async function createEmptyProfileForUser(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  userId: string,
  userRole?: UserRole | null,
) {
  const now = new Date();
  const [newProfile] = await tx
    .insert(profile)
    .values({
      userId,
      userRole: userRole ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return newProfile;
}

// High-level service function: creates user with personal org (no profile)
// Use this for regular registration where user will complete onboarding
export async function createUser(email: string) {
  const normalizedEmail = email.trim().toLowerCase();

  try {
    return db.transaction(async (tx) => {
      const newUser = await createUserRecord(tx, normalizedEmail);
      await createPersonalOrganizationForUser(tx, newUser.id, normalizedEmail);
      return [newUser];
    });
  } catch (error) {
    console.error("Failed to create user in database:", error);
    throw error;
  }
}

// High-level service function: creates user with personal org AND a profile.
// Use this for self-service registration where the user skips onboarding; the
// role chosen at signup (when provided) is persisted on the profile.
export async function createUserWithProfile(
  email: string,
  userRole?: UserRole | null,
) {
  const normalizedEmail = email.trim().toLowerCase();

  try {
    return db.transaction(async (tx) => {
      const newUser = await createUserRecord(tx, normalizedEmail);
      await createPersonalOrganizationForUser(tx, newUser.id, normalizedEmail);
      await createEmptyProfileForUser(tx, newUser.id, userRole);
      return [newUser];
    });
  } catch (error) {
    console.error("Failed to create user with profile in database:", error);
    throw error;
  }
}

export async function saveChat({
  id,
  userId,
  title,
  projectId,
  isInitial,
}: {
  id: string;
  userId: string;
  title: string;
  projectId?: string;
  isInitial?: boolean;
}) {
  try {
    // Validate projectId exists if provided
    if (projectId) {
      const [existingProject] = await db
        .select({ id: project.id })
        .from(project)
        .where(eq(project.id, projectId))
        .limit(1);

      if (!existingProject) {
        throw new Error(`Project with ID ${projectId} does not exist`);
      }
    }

    const now = new Date();
    return await db.insert(chat).values({
      id,
      createdAt: now,
      updatedAt: now,
      userId,
      title,
      projectId,
      ...(isInitial !== undefined && { isInitial }),
    });
  } catch (error) {
    console.error("Failed to save chat in database");
    throw error;
  }
}

export async function deleteChatById({ id }: { id: string }) {
  try {
    await db.delete(message).where(eq(message.chatId, id));

    return await db.delete(chat).where(eq(chat.id, id));
  } catch (error) {
    console.error("Failed to delete chat by id from database");
    throw error;
  }
}

export async function getChatsByUserId({
  id,
  limit,
  startingAfter,
  endingBefore,
}: {
  id: string;
  limit: number;
  startingAfter: string | null;
  endingBefore: string | null;
}) {
  try {
    const extendedLimit = limit + 1;

    const query = (whereCondition?: SQL) =>
      db
        .select()
        .from(chat)
        .where(
          whereCondition
            ? and(whereCondition, eq(chat.userId, id))
            : eq(chat.userId, id),
        )
        .orderBy(desc(chat.createdAt))
        .limit(extendedLimit);

    let filteredChats: Array<Chat> = [];

    if (startingAfter) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, startingAfter))
        .limit(1);

      if (!selectedChat) {
        throw new Error(`Chat with id ${startingAfter} not found`);
      }

      filteredChats = await query(gt(chat.createdAt, selectedChat.createdAt));
    } else if (endingBefore) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, endingBefore))
        .limit(1);

      if (!selectedChat) {
        throw new Error(`Chat with id ${endingBefore} not found`);
      }

      filteredChats = await query(lt(chat.createdAt, selectedChat.createdAt));
    } else {
      filteredChats = await query();
    }

    const hasMore = filteredChats.length > limit;

    return {
      chats: hasMore ? filteredChats.slice(0, limit) : filteredChats,
      hasMore,
    };
  } catch (error) {
    console.error("Failed to get chats by user from database");
    throw error;
  }
}

export async function getChatById({ id }: { id: string }) {
  try {
    const [selectedChat] = await db.select().from(chat).where(eq(chat.id, id));
    return selectedChat;
  } catch (error) {
    console.error("Failed to get chat by id from database");
    throw error;
  }
}

export async function getChatsByProjectId({
  projectId,
  limit = 50,
  offset = 0,
}: {
  projectId: string;
  limit?: number;
  offset?: number;
}) {
  try {
    const chats = await db
      .select()
      .from(chat)
      .where(eq(chat.projectId, projectId))
      .orderBy(desc(chat.updatedAt))
      .limit(limit)
      .offset(offset);

    return chats;
  } catch (error) {
    console.error("Failed to get chats by project from database");
    throw error;
  }
}

export async function getInitialChatByProjectId(
  projectId: string,
): Promise<Chat | null> {
  try {
    const [initialChat] = await db
      .select()
      .from(chat)
      .where(and(eq(chat.projectId, projectId), eq(chat.isInitial, true)))
      .limit(1);
    return initialChat ?? null;
  } catch (error) {
    console.error("Failed to get initial chat by project id from database");
    throw error;
  }
}

export async function saveMessages({
  messages,
}: {
  messages: Array<DBMessage>;
}) {
  try {
    // Insert the new messages
    const result = await db.insert(message).values(messages);

    // Update the chat's updatedAt timestamp for all affected chats
    const uniqueChatIds = [...new Set(messages.map((msg) => msg.chatId))];
    for (const chatId of uniqueChatIds) {
      await db
        .update(chat)
        .set({ updatedAt: new Date() })
        .where(eq(chat.id, chatId));
    }

    return result;
  } catch (error) {
    console.error("Failed to save messages in database", error);
    throw error;
  }
}

export async function getMessagesByChatId({ id }: { id: string }) {
  try {
    return await db
      .select()
      .from(message)
      .where(eq(message.chatId, id))
      .orderBy(asc(message.createdAt));
  } catch (error) {
    console.error("Failed to get messages by chat id from database", error);
    throw error;
  }
}

export async function saveDocument({
  id,
  title,
  kind,
  content,
  userId,
  chatId,
}: {
  id: string;
  title: string;
  kind: "text" | "tasks" | "map";
  content: string;
  userId: string;
  chatId?: string;
}) {
  try {
    return await db.insert(document).values({
      id,
      title,
      kind,
      content,
      userId,
      chatId,
      createdAt: new Date(),
    });
  } catch (error) {
    console.error("Failed to save document in database");
    throw error;
  }
}

export async function getDocumentsById({ id }: { id: string }) {
  try {
    const documents = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(asc(document.createdAt));

    return documents;
  } catch (error) {
    console.error("Failed to get document by id from database");
    throw error;
  }
}

export async function getDocumentById({ id }: { id: string }) {
  try {
    const [selectedDocument] = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(desc(document.createdAt));

    return selectedDocument;
  } catch (error) {
    console.error("Failed to get document by id from database");
    throw error;
  }
}

export async function saveSuggestions({
  suggestions,
}: {
  suggestions: Array<Suggestion>;
}) {
  try {
    return await db.insert(suggestion).values(suggestions);
  } catch (error) {
    console.error("Failed to save suggestions in database");
    throw error;
  }
}

export async function getSuggestionsByDocumentId({
  documentId,
}: {
  documentId: string;
}) {
  try {
    return await db
      .select()
      .from(suggestion)
      .where(and(eq(suggestion.documentId, documentId)));
  } catch (error) {
    console.error(
      "Failed to get suggestions by document version from database",
    );
    throw error;
  }
}

export async function deleteDocumentsByIdAfterTimestamp({
  id,
  timestamp,
}: {
  id: string;
  timestamp: Date;
}) {
  try {
    return await db
      .delete(document)
      .where(and(eq(document.id, id), gt(document.createdAt, timestamp)));
  } catch (error) {
    console.error(
      "Failed to delete documents by id after timestamp from database",
    );
    throw error;
  }
}

export async function getMessageById({ id }: { id: string }) {
  try {
    return await db.select().from(message).where(eq(message.id, id));
  } catch (error) {
    console.error("Failed to get message by id from database");
    throw error;
  }
}

export async function deleteMessagesByChatIdAfterTimestamp({
  chatId,
  timestamp,
}: {
  chatId: string;
  timestamp: Date;
}) {
  try {
    const messagesToDelete = await db
      .select({ id: message.id })
      .from(message)
      .where(
        and(eq(message.chatId, chatId), gte(message.createdAt, timestamp)),
      );

    const messageIds = messagesToDelete.map((message) => message.id);

    if (messageIds.length > 0) {
      return await db
        .delete(message)
        .where(
          and(eq(message.chatId, chatId), inArray(message.id, messageIds)),
        );
    }
  } catch (error) {
    console.error(
      "Failed to delete messages by id after timestamp from database",
    );
    throw error;
  }
}

export async function updateChatVisiblityById({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: "private" | "public";
}) {
  try {
    return await db.update(chat).set({ visibility }).where(eq(chat.id, chatId));
  } catch (error) {
    console.error("Failed to update chat visibility in database");
    throw error;
  }
}

export async function getProjectIdByDocumentId({
  id,
}: {
  id: string;
}): Promise<string | null> {
  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(id)) return null;

  try {
    const result = await db
      .select({ projectId: chat.projectId })
      .from(document)
      .innerJoin(chat, eq(document.chatId, chat.id))
      .where(and(eq(document.id, id), isNotNull(document.chatId)))
      .limit(1);
    return result[0]?.projectId ?? null;
  } catch {
    console.error("Failed to get project id by document id");
    return null;
  }
}
