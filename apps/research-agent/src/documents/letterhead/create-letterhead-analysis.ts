/**
 * Wires the letterhead analysis loop to the real database queries, worker
 * thread and logo storage. Null when the analysis is off: the loop does not
 * run and documents stay "pending" until it is turned on. Without a logo store
 * letterheads are stored without their logos.
 */

import {
  claimOrganizationDocumentLetterhead,
  claimProjectDocumentLetterhead,
  failExhaustedOrganizationDocumentLetterheads,
  failExhaustedProjectDocumentLetterheads,
  getOrganizationDocumentsPendingLetterhead,
  getProjectDocumentsPendingLetterhead,
  updateOrganizationDocumentLetterhead,
  updateProjectDocumentLetterhead,
} from "@wildfires-org/turboplan-db/queries";

import type { LetterheadModelSettings } from "../../infra/model-provider";
import type { DocumentLoop } from "../document-poll-loop";
import { runLetterheadInWorker } from "../run-extraction-in-worker";
import type { WorkerGate } from "../worker-gate";
import {
  createLetterheadAnalysisService,
  type LetterheadLogoStore,
} from "./analysis-service";

type CreateLetterheadAnalysisOptions = {
  storeLogo?: LetterheadLogoStore;
  /** Shared with the extraction loop: one document worker at a time. */
  workerGate?: WorkerGate;
};

export const createLetterheadAnalysis = (
  settings: LetterheadModelSettings | null,
  { storeLogo, workerGate }: CreateLetterheadAnalysisOptions = {},
): DocumentLoop | null => {
  if (!settings) {
    return null;
  }
  return createLetterheadAnalysisService({
    // Newest first (see the queries): a fresh upload is analyzed within
    // seconds even while older documents wait.
    sources: [
      {
        name: "project",
        fetchPending: (limit) => getProjectDocumentsPendingLetterhead(limit),
        claim: (id) => claimProjectDocumentLetterhead(id),
        failExhausted: () => failExhaustedProjectDocumentLetterheads(),
        persist: (id, update) => updateProjectDocumentLetterhead(id, update),
      },
      {
        name: "organization",
        fetchPending: (limit) =>
          getOrganizationDocumentsPendingLetterhead(limit),
        claim: (id) => claimOrganizationDocumentLetterhead(id),
        failExhausted: () => failExhaustedOrganizationDocumentLetterheads(),
        persist: (id, update) =>
          updateOrganizationDocumentLetterhead(id, update),
      },
    ],
    analyze: ({ url }) => runLetterheadInWorker({ url, settings }),
    storeLogo,
    workerGate,
  });
};
