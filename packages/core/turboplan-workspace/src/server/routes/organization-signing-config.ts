import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import { organizationSigningConfig } from "@wildfires-org/turboplan-db";
import { db } from "@wildfires-org/turboplan-db/db-client";
import {
  decryptSecret,
  encryptSecret,
} from "@wildfires-org/turboplan-env/crypto";
import { Action, EntityType } from "@wildfires-org/turboplan-rbac";
import {
  type RBACContext,
  requirePermission,
} from "@wildfires-org/turboplan-rbac/hono";

const upsertSigningConfigSchema = z.object({
  documensoApiUrl: z.string().url(),
  documensoApiKey: z.string().min(1),
  documensoWebhookSecret: z.string().optional(),
  isEnabled: z.boolean().optional(),
});

const maskApiKey = (key: string): string => {
  if (key.length <= 4) {
    return "****";
  }
  return `****${key.slice(-4)}`;
};

export const organizationSigningConfigRouter = new Hono<RBACContext>();

// GET /:id/signing-config - Get signing config for organization
organizationSigningConfigRouter.get(
  "/:id/signing-config",
  requirePermission(
    EntityType.ORGANIZATION,
    Action.MANAGE_MEMBERS,
    (c) => c.req.param("id") ?? null,
  ),
  async (c) => {
    try {
      const orgId = c.req.param("id") as string;

      const [config] = await db
        .select()
        .from(organizationSigningConfig)
        .where(eq(organizationSigningConfig.organizationId, orgId))
        .limit(1);

      if (!config) {
        return c.json({ config: null });
      }

      return c.json({
        config: {
          ...config,
          documensoApiKey: maskApiKey(decryptSecret(config.documensoApiKey)),
          // Never expose the webhook secret (encrypted or not) on read.
          documensoWebhookSecret: config.documensoWebhookSecret ? "****" : null,
        },
      });
    } catch (error) {
      console.error("Failed to get signing config:", error);
      return c.json({ error: "Internal Server Error" }, 500);
    }
  },
);

// PUT /:id/signing-config - Create or update signing config
organizationSigningConfigRouter.put(
  "/:id/signing-config",
  requirePermission(
    EntityType.ORGANIZATION,
    Action.MANAGE_MEMBERS,
    (c) => c.req.param("id") ?? null,
  ),
  async (c) => {
    try {
      const orgId = c.req.param("id") as string;
      const body = await c.req.json();

      const validationResult = upsertSigningConfigSchema.safeParse(body);
      if (!validationResult.success) {
        return c.json(
          {
            error: "Validation failed",
            details: validationResult.error.issues,
          },
          400,
        );
      }

      const {
        documensoApiUrl,
        documensoApiKey,
        documensoWebhookSecret,
        isEnabled,
      } = validationResult.data;

      // Encrypt secrets at rest.
      const encryptedApiKey = encryptSecret(documensoApiKey);
      const encryptedWebhookSecret = documensoWebhookSecret
        ? encryptSecret(documensoWebhookSecret)
        : null;

      const [saved] = await db
        .insert(organizationSigningConfig)
        .values({
          organizationId: orgId,
          documensoApiUrl,
          documensoApiKey: encryptedApiKey,
          documensoWebhookSecret: encryptedWebhookSecret,
          isEnabled: isEnabled ?? true,
        })
        .onConflictDoUpdate({
          target: organizationSigningConfig.organizationId,
          set: {
            documensoApiUrl,
            documensoApiKey: encryptedApiKey,
            documensoWebhookSecret: encryptedWebhookSecret,
            isEnabled: isEnabled ?? true,
            updatedAt: new Date(),
          },
        })
        .returning();

      return c.json({
        config: {
          ...saved,
          documensoApiKey: maskApiKey(decryptSecret(saved.documensoApiKey)),
          documensoWebhookSecret: saved.documensoWebhookSecret ? "****" : null,
        },
      });
    } catch (error) {
      console.error("Failed to upsert signing config:", error);
      return c.json({ error: "Internal Server Error" }, 500);
    }
  },
);

// DELETE /:id/signing-config - Delete signing config
organizationSigningConfigRouter.delete(
  "/:id/signing-config",
  requirePermission(
    EntityType.ORGANIZATION,
    Action.MANAGE_MEMBERS,
    (c) => c.req.param("id") ?? null,
  ),
  async (c) => {
    try {
      const orgId = c.req.param("id") as string;

      await db
        .delete(organizationSigningConfig)
        .where(eq(organizationSigningConfig.organizationId, orgId));

      return c.json({ success: true });
    } catch (error) {
      console.error("Failed to delete signing config:", error);
      return c.json({ error: "Internal Server Error" }, 500);
    }
  },
);
