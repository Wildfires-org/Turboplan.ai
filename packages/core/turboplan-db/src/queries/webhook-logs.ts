import { and, desc, eq, inArray } from "drizzle-orm";

import { db } from "../db-client";
import { webhookRequestLog } from "../schemas";

/**
 * List webhook logs with filtering.
 * Returns up to 1000 most recent lightweight entries (no full bodies) for list view.
 */
export async function getWebhookLogs({ source }: { source?: string } = {}) {
  const conditions = [];
  if (source) conditions.push(eq(webhookRequestLog.source, source));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const logs = await db
    .select({
      id: webhookRequestLog.id,
      source: webhookRequestLog.source,
      path: webhookRequestLog.path,
      method: webhookRequestLog.method,
      responseStatus: webhookRequestLog.responseStatus,
      runId: webhookRequestLog.runId,
      durationMs: webhookRequestLog.durationMs,
      createdAt: webhookRequestLog.createdAt,
    })
    .from(webhookRequestLog)
    .where(where)
    .orderBy(desc(webhookRequestLog.createdAt))
    .limit(1000);

  return { logs };
}

/**
 * Get a single webhook log entry with full request/response bodies.
 */
export async function getWebhookLogById(id: string) {
  const [log] = await db
    .select()
    .from(webhookRequestLog)
    .where(eq(webhookRequestLog.id, id))
    .limit(1);

  return log ?? null;
}

export async function deleteWebhookLogs(ids: string[]) {
  if (ids.length === 0) {
    return { deleted: 0 };
  }
  const result = await db
    .delete(webhookRequestLog)
    .where(inArray(webhookRequestLog.id, ids))
    .returning({ id: webhookRequestLog.id });
  return { deleted: result.length };
}
