import type { Suggestion } from "@wildfires-org/turboplan-db/types";

/**
 * Artifact-specific stream deltas
 * These are the deltas that artifact handlers should process.
 *
 * In v6, these arrive via the onData callback as DataUIParts with
 * type "data-artifact". The processing logic now lives in
 * project-chat.tsx's onArtifactDelta callback.
 */
export type ArtifactStreamDelta = {
  type:
    | "text-delta"
    | "code-delta"
    | "sheet-delta"
    | "image-delta"
    | "title"
    | "id"
    | "suggestion"
    | "clear"
    | "finish"
    | "kind"
    | "debug-user-context"
    | "debug-project-context";
  content: string | Suggestion;
};

/**
 * All possible data stream deltas (discriminated union)
 */
export type DataStreamDelta = ArtifactStreamDelta;
