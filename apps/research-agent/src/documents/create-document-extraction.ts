/**
 * Wires the extraction loop to the real database queries and worker thread.
 */

import {
  getOrganizationDocumentsPendingExtraction,
  getProjectDocumentsPendingExtraction,
  updateOrganizationDocumentExtraction,
  updateProjectDocumentExtraction,
} from "@wildfires-org/turboplan-db/queries";

import {
  createDocumentExtractionService,
  type DocumentExtractionService,
  type DocumentSummarizer,
} from "./extraction-service";
import { runExtractionInWorker } from "./run-extraction-in-worker";

type CreateDocumentExtractionOptions = {
  /** Key-facts summaries for organization documents; omitted without a fast model. */
  summarize?: DocumentSummarizer;
};

export const createDocumentExtraction = ({
  summarize,
}: CreateDocumentExtractionOptions = {}): DocumentExtractionService =>
  createDocumentExtractionService({
    sources: [
      {
        name: "project",
        fetchPending: (limit) => getProjectDocumentsPendingExtraction(limit),
        persist: (id, data) => updateProjectDocumentExtraction(id, data),
      },
      {
        name: "organization",
        fetchPending: (limit) =>
          getOrganizationDocumentsPendingExtraction(limit),
        persist: (id, data) => updateOrganizationDocumentExtraction(id, data),
        summarize,
      },
    ],
    runExtraction: (input) => runExtractionInWorker(input),
  });
