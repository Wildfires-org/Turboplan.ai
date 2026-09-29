import type { Context } from "hono";

import type { DocumentExtractionService } from "../../documents/extraction-service";
import { logger } from "../../infra/logger";
import { validateExtractDocumentsBody } from "../validation";

/**
 * Nudges the extraction loop to run now instead of waiting for the next poll.
 *
 * `documentIds` is accepted (and logged) but not yet used to target specific
 * rows — the loop always drains the oldest pending documents first.
 */
export function createExtractDocumentsHandler(
  service: DocumentExtractionService,
) {
  return async (c: Context): Promise<Response> => {
    let body: unknown = {};
    try {
      const raw = await c.req.text();
      if (raw.trim().length > 0) {
        body = JSON.parse(raw);
      }
    } catch {
      return c.json({ error: "Invalid JSON" }, 400);
    }

    const { ok, data, error } = validateExtractDocumentsBody(body);
    if (!ok) {
      return c.json({ error }, 400);
    }

    if (data.documentIds && data.documentIds.length > 0) {
      logger.log(
        `Extraction requested for ${data.documentIds.length} document(s)`,
        "info",
      );
    }

    service.wake();

    return c.json({ queued: true }, 202);
  };
}
