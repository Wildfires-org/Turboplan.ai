/**
 * Storage keys of documents a visitor attached to the landing-page prompt
 * ride the landing-page -> /self-service handoff URL as one
 * `LANDING_UPLOADS_PARAM` per key.
 *
 * The keys are untrusted input; the self-service actions re-validate them
 * server-side before turning them into project documents.
 */
import {
  LANDING_UPLOADS_PARAM,
  MAX_LANDING_UPLOADS,
} from "@wildfires-org/turboplan-upload/types";

type ParamReader = Pick<URLSearchParams, "getAll">;

/**
 * The landing upload keys on a URL, or undefined when there are none. Capped
 * at what the self-service schema accepts, so a hand-edited URL with extra
 * keys drops them instead of failing the whole signup.
 */
export const parseLandingUploadKeys = (
  params: ParamReader,
): string[] | undefined => {
  const keys = [...new Set(params.getAll(LANDING_UPLOADS_PARAM))]
    .filter(Boolean)
    .slice(0, MAX_LANDING_UPLOADS);
  return keys.length > 0 ? keys : undefined;
};

/**
 * Copies the landing upload keys onto an outgoing URL so they survive a
 * redirect (e.g. self-service -> login -> back to self-service).
 */
export const appendLandingUploadParams = (
  target: URLSearchParams,
  keys: string[] | undefined,
) => {
  for (const key of keys ?? []) {
    target.append(LANDING_UPLOADS_PARAM, key);
  }
  return target;
};
