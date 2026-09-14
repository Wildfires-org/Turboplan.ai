import type { Context } from "hono";
import { Hono } from "hono";

import { generatePAT } from "@wildfires-org/turboplan-api-client";
import {
  createPersonalAccessToken,
  listPATsByUser,
  revokePAT,
} from "@wildfires-org/turboplan-db/queries";

const MAX_ACTIVE_TOKENS_PER_USER = 25;
const NAME_MAX_LENGTH = 255;
const ACTOR_MAX_LENGTH = 100;
const SAFE_STRING_PATTERN = /^[\w\s\-.,()@]+$/;

export const patRouter = new Hono();

patRouter.post("/", async (c: Context) => {
  const user = c.get("user");
  if (!user?.userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  let body: { name: string; actor: string; expiresAt?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  if (!body.name || !body.actor) {
    return c.json({ error: "name and actor are required" }, 400);
  }

  const name = body.name.trim();
  const actor = body.actor.trim();

  if (name.length > NAME_MAX_LENGTH || name.length === 0) {
    return c.json(
      { error: `name must be 1-${NAME_MAX_LENGTH} characters` },
      400,
    );
  }

  if (actor.length > ACTOR_MAX_LENGTH || actor.length === 0) {
    return c.json(
      { error: `actor must be 1-${ACTOR_MAX_LENGTH} characters` },
      400,
    );
  }

  if (!SAFE_STRING_PATTERN.test(name) || !SAFE_STRING_PATTERN.test(actor)) {
    return c.json(
      {
        error:
          "name and actor must contain only letters, numbers, spaces, and basic punctuation",
      },
      400,
    );
  }

  let expiresAt: Date | null = null;
  if (body.expiresAt) {
    const parsed = new Date(body.expiresAt);
    if (Number.isNaN(parsed.getTime()) || parsed <= new Date()) {
      return c.json({ error: "expiresAt must be a valid future date" }, 400);
    }
    expiresAt = parsed;
  }

  const existing = await listPATsByUser(user.userId);
  const activeCount = existing.filter((t) => !t.revokedAt).length;
  if (activeCount >= MAX_ACTIVE_TOKENS_PER_USER) {
    return c.json(
      {
        error: `Maximum of ${MAX_ACTIVE_TOKENS_PER_USER} active tokens allowed. Revoke unused tokens first.`,
      },
      429,
    );
  }

  const { plaintext, hash, prefix } = generatePAT();

  const record = await createPersonalAccessToken({
    userId: user.userId,
    name,
    actor,
    tokenHash: hash,
    tokenPrefix: prefix,
    expiresAt,
  });

  return c.json({
    token: plaintext,
    id: record.id,
    name: record.name,
    actor: record.actor,
    prefix: record.tokenPrefix,
    expiresAt: record.expiresAt,
    createdAt: record.createdAt,
  });
});

patRouter.get("/", async (c: Context) => {
  const user = c.get("user");
  if (!user?.userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const tokens = await listPATsByUser(user.userId);
  return c.json(tokens);
});

patRouter.delete("/:id", async (c: Context) => {
  const user = c.get("user");
  if (!user?.userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const id = c.req.param("id")!;
  const revoked = await revokePAT(id, user.userId);

  if (!revoked) {
    return c.json({ error: "Token not found or already revoked" }, 404);
  }

  return c.json({ success: true });
});
