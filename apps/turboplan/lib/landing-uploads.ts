import { MAX_LANDING_UPLOADS } from "@/app/self-service/types";

/**
 * Storage keys of documents a visitor attached to the landing-page prompt,
 * carried on the landing-page -> /self-service handoff URL as one param per
 * key. Contract with the landing page — do not rename.
 *
 * The keys are untrusted input; the self-service actions re-validate them
 * server-side before turning them into project documents.
 */
export const LANDING_UPLOADS_PARAM = "landingUploads";

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
