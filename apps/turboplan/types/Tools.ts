export const Tools = {
  createDocument: "createDocument",
  updateDocument: "updateDocument",
  requestSuggestions: "requestSuggestions",
  generateQuickResponses: "generateQuickResponses",
  webSearch: "webSearch",
  getContents: "getContents",
  researchNotes: "researchNotes",
} as const;

export type Tools = (typeof Tools)[keyof typeof Tools];
