import { and, eq, isNull } from "drizzle-orm";

import { db } from "../db-client";
import { personalAccessToken, profile, user } from "../schemas";

export const createPersonalAccessToken = async (data: {
  userId: string;
  name: string;
  actor: string;
  tokenHash: string;
  tokenPrefix: string;
  expiresAt?: Date | null;
}) => {
  const [record] = await db
    .insert(personalAccessToken)
    .values({
      userId: data.userId,
      name: data.name,
      actor: data.actor,
      tokenHash: data.tokenHash,
      tokenPrefix: data.tokenPrefix,
      expiresAt: data.expiresAt ?? null,
    })
    .returning();
  return record;
};

export const findPATByHash = async (tokenHash: string) => {
  const now = new Date();

  const [record] = await db
    .select({
      id: personalAccessToken.id,
      userId: personalAccessToken.userId,
      name: personalAccessToken.name,
      actor: personalAccessToken.actor,
      tokenPrefix: personalAccessToken.tokenPrefix,
      expiresAt: personalAccessToken.expiresAt,
      email: user.email,
      userRole: profile.userRole,
    })
    .from(personalAccessToken)
    .innerJoin(user, eq(personalAccessToken.userId, user.id))
    .leftJoin(profile, eq(user.id, profile.userId))
    .where(
      and(
        eq(personalAccessToken.tokenHash, tokenHash),
        isNull(personalAccessToken.revokedAt),
      ),
    )
    .limit(1);

  if (!record) {
    return null;
  }

  if (record.expiresAt && record.expiresAt < now) {
    return null;
  }

  return record;
};

export const listPATsByUser = async (userId: string) => {
  return db
    .select({
      id: personalAccessToken.id,
      name: personalAccessToken.name,
      actor: personalAccessToken.actor,
      tokenPrefix: personalAccessToken.tokenPrefix,
      lastUsedAt: personalAccessToken.lastUsedAt,
      expiresAt: personalAccessToken.expiresAt,
      revokedAt: personalAccessToken.revokedAt,
      createdAt: personalAccessToken.createdAt,
    })
    .from(personalAccessToken)
    .where(eq(personalAccessToken.userId, userId))
    .orderBy(personalAccessToken.createdAt);
};

export const revokePAT = async (id: string, userId: string) => {
  const [record] = await db
    .update(personalAccessToken)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(personalAccessToken.id, id),
        eq(personalAccessToken.userId, userId),
        isNull(personalAccessToken.revokedAt),
      ),
    )
    .returning();
  return record ?? null;
};

export const updatePATLastUsed = async (id: string) => {
  await db
    .update(personalAccessToken)
    .set({ lastUsedAt: new Date() })
    .where(eq(personalAccessToken.id, id));
};
