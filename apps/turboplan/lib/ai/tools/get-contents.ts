import { tool } from "ai";
import { z } from "zod";

import { getPrompt } from "@wildfires-org/turboplan-ai";
import { isStorageHost } from "@wildfires-org/turboplan-upload/server";

import { exaGetContents } from "@/lib/ai/exa-client";
import type { ReferenceCache } from "@/lib/ai/reference-documents";

const STORAGE_URL_NOTE =
  "Not read: these are files saved to the project or organization. Read them with readProjectDocuments or readOrganizationDocuments, or pass the document's ID in createDocument's referenceDocumentIds.";

export const getContents = async ({
  referenceCache,
}: {
  /** Collects full-text reads so createDocument can pass them by URL. */
  referenceCache: ReferenceCache;
}) => {
  const description = await getPrompt("tool-desc-get-contents");

  return tool({
    description,
    inputSchema: z.object({
      urls: z
        .array(z.string().url())
        .min(1)
        .max(5)
        .describe("URLs to read (max 5)"),
      maxCharacters: z
        .number()
        .int()
        .min(500)
        .max(10000)
        .optional()
        .describe(
          "Request full sequential text content per URL (up to 10000 chars). Only pass this when you need to deep-read a document. By default, only highlights and summaries are returned.",
        ),
    }),
    execute: async ({ urls, maxCharacters }) => {
      // Our own storage URLs never go to a third party (Exa): saved files are
      // read from the database by the document tools.
      const storageUrls = urls.filter(isStorageHost);
      const webUrls = urls.filter((url) => !isStorageHost(url));
      const skipped =
        storageUrls.length > 0
          ? { skippedUrls: storageUrls, note: STORAGE_URL_NOTE }
          : {};
      if (webUrls.length === 0) {
        return { results: [], ...skipped };
      }

      const response = await exaGetContents(webUrls, maxCharacters);

      if (response.warning) {
        return { results: [], warning: response.warning, ...skipped };
      }

      referenceCache.remember(response.results);

      const results = response.results.map((result) => ({
        url: result.url,
        title: result.title,
        ...(result.text && { content: result.text }),
        ...(result.highlights && { highlights: result.highlights }),
        ...(result.summary && { summary: result.summary }),
      }));

      return { results, ...skipped };
    },
  });
};
