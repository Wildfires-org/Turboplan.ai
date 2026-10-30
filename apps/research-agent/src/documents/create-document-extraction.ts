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
import { runUngated, type WorkerGate } from "./worker-gate";

type CreateDocumentExtractionOptions = {
  /** Key-facts summaries for organization documents; omitted without a fast model. */
  summarize?: DocumentSummarizer;
  /** Shared with the letterhead loop: one document worker at a time. */
  workerGate?: WorkerGate;
};

export const createDocumentExtraction = ({
  summarize,
  workerGate = runUngated,
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
    // The worker (and its timeout) starts once the gate is held.
    runExtraction: (input) => workerGate(() => runExtractionInWorker(input)),
  });
