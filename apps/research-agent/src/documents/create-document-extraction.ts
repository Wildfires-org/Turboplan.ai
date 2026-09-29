/**
 * Wires the extraction loop to the real database queries and worker thread.
 */

import {
  getProjectDocumentsPendingExtraction,
  updateProjectDocumentExtraction,
} from "@wildfires-org/turboplan-db/queries";

import {
  createDocumentExtractionService,
  type DocumentExtractionService,
} from "./extraction-service";
import { runExtractionInWorker } from "./run-extraction-in-worker";

export const createDocumentExtraction = (): DocumentExtractionService =>
  createDocumentExtractionService({
    fetchPending: (limit) => getProjectDocumentsPendingExtraction(limit),
    persist: (id, data) => updateProjectDocumentExtraction(id, data),
    runExtraction: (input) => runExtractionInWorker(input),
  });
