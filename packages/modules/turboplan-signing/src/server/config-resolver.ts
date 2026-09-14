import { eq } from "drizzle-orm";

import {
  office,
  organizationSigningConfig,
  project,
} from "@wildfires-org/turboplan-db";
import { db } from "@wildfires-org/turboplan-db/db-client";
import { decryptSecret } from "@wildfires-org/turboplan-env/crypto";

export type DocumensoConfig = {
  apiUrl: string;
  apiKey: string;
  // Per-org webhook secret (decrypted), if configured. Used to verify inbound
  // Documenso webhooks for this organization.
  webhookSecret: string | null;
};

export const resolveDocumensoConfig = async (
  projectId: string,
): Promise<DocumensoConfig | null> => {
  const [result] = await db
    .select({
      apiUrl: organizationSigningConfig.documensoApiUrl,
      apiKey: organizationSigningConfig.documensoApiKey,
      webhookSecret: organizationSigningConfig.documensoWebhookSecret,
    })
    .from(project)
    .innerJoin(office, eq(project.officeId, office.id))
    .innerJoin(
      organizationSigningConfig,
      eq(office.organizationId, organizationSigningConfig.organizationId),
    )
    .where(eq(project.id, projectId))
    .limit(1);

  if (!result) {
    return null;
  }

  // Secrets are stored encrypted at rest; decrypt before use. decryptSecret is
  // a no-op for legacy plaintext values.
  return {
    apiUrl: result.apiUrl,
    apiKey: decryptSecret(result.apiKey),
    webhookSecret: result.webhookSecret
      ? decryptSecret(result.webhookSecret)
      : null,
  };
};
